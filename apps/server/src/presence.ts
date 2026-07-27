import type { FastifyInstance } from 'fastify'
import { db } from '@timegems/db'

// Presence is intentionally NOT a database table -- it's ephemeral,
// in-memory, single-process state. The database remains the sole source of
// truth for actual work sessions; losing this map (a restart) loses nothing
// real, it just means everyone re-announces themselves on reconnect.
//
// This route is registered directly on the Fastify instance, bypassing
// fastify-openapi-glue on purpose: OpenAPI 3.1 has no first-class way to
// describe a WebSocket connection's message protocol, and forcing this into
// the REST contract would be a worse fit than a small, clearly-commented
// exception to the "everything goes through the spec" rule.

type Status = 'online' | 'working' | 'paused'
type SessionStatus = 'working' | 'paused'

// A user can have several concurrent sessions now (one per project -- see
// UserActiveSession), so presence is keyed per-session, not a single
// status/projectId per user. `sessions` is a live snapshot of every session
// the client last reported; the derived top-level status/projectId/etc. on
// the wire (see `serialize`) exist only so existing single-value UI (the
// Team page's PresenceIndicator, the avatar-strip PresenceStrip) keeps
// working without caring which of several sessions is "the" one.
interface SessionPresence {
  workSessionId: string
  projectId: string | null
  projectName: string | null
  status: SessionStatus
  sessionStartedAt: string
}

interface PresenceState {
  userId: string
  name: string
  avatarUrl: string | null
  sessions: Map<string, SessionPresence> // keyed by workSessionId
  lastHeartbeat: number
  sockets: Set<any>
}

const STALE_MS = 45_000 // ~3 missed 15s heartbeats before we call it offline
const SWEEP_INTERVAL_MS = 10_000
const MAX_MESSAGE_BYTES = 4 * 1024
const VALID_SESSION_STATUSES = new Set<SessionStatus>(['working', 'paused'])

// tenantId -> userId -> state
const tenantPresence = new Map<string, Map<string, PresenceState>>()

// A running session wins over a paused one when picking the single
// "primary" session for the derived top-level fields -- same rule the
// frontend stopgaps use elsewhere until per-session UI (project rooms,
// floating indicators) fully replaces single-value displays.
function serialize(state: PresenceState) {
  const sessions = [...state.sessions.values()]
  const primary = sessions.find((s) => s.status === 'working') ?? sessions[0] ?? null
  return {
    userId: state.userId,
    name: state.name,
    avatarUrl: state.avatarUrl,
    status: (primary?.status ?? 'online') as Status,
    projectId: primary?.projectId ?? null,
    projectName: primary?.projectName ?? null,
    sessionStartedAt: primary?.sessionStartedAt ?? null,
    lastHeartbeat: state.lastHeartbeat,
    sessions,
  }
}

function broadcast(tenantId: string) {
  const usersMap = tenantPresence.get(tenantId)
  if (!usersMap) return
  const payload = JSON.stringify({ type: 'presence', entries: [...usersMap.values()].map(serialize) })
  for (const state of usersMap.values()) {
    for (const socket of state.sockets) {
      if (socket.readyState === socket.OPEN) socket.send(payload)
    }
  }
}

export interface ProjectNoteActivity {
  workSessionId: string
  note: {
    id: string
    body: string
    createdAt: string
    updatedAt: string
    author: { id: string; name: string; avatarUrl: string | null }
  }
}

export interface ProjectActivityMessage {
  type: 'project-activity'
  projectId: string
  item: import('./lib/projectActivity').ProjectFeedItem
}

function usersInProjectRoom(usersMap: Map<string, PresenceState>, projectId: string) {
  const sockets: any[] = []
  for (const state of usersMap.values()) {
    const inRoom = [...state.sessions.values()].some((s) => s.projectId === projectId)
    if (!inRoom) continue
    for (const socket of state.sockets) {
      if (socket.readyState === socket.OPEN) sockets.push(socket)
    }
  }
  return sockets
}

export function broadcastProjectActivity(
  tenantId: string,
  projectId: string,
  item: import('./lib/projectActivity').ProjectFeedItem,
) {
  const usersMap = tenantPresence.get(tenantId)
  if (!usersMap) return
  const message = JSON.stringify({ type: 'project-activity', projectId, item } satisfies ProjectActivityMessage)
  for (const socket of usersInProjectRoom(usersMap, projectId)) {
    socket.send(message)
  }
}

// A project with several users each running their own concurrent session on
// it is a "room" -- this is the live half of that: pushed to everyone whose
// presence currently reports a session on this project (the author's own
// other tabs included), over the same socket presence already uses rather
// than standing up a second connection. Reuses `tenantPresence` purely as a
// read -- it never mutates presence state itself.
export function broadcastProjectNote(tenantId: string, projectId: string, activity: ProjectNoteActivity) {
  const usersMap = tenantPresence.get(tenantId)
  if (!usersMap) return
  const message = JSON.stringify({ type: 'project-note', projectId, ...activity })
  for (const socket of usersInProjectRoom(usersMap, projectId)) {
    socket.send(message)
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [tenantId, usersMap] of tenantPresence) {
    let changed = false
    for (const [userId, state] of usersMap) {
      if (now - state.lastHeartbeat > STALE_MS) {
        for (const socket of state.sockets) socket.close()
        usersMap.delete(userId)
        changed = true
      }
    }
    if (usersMap.size === 0) tenantPresence.delete(tenantId)
    else if (changed) broadcast(tenantId)
  }
}, SWEEP_INTERVAL_MS)

export function registerPresence(server: FastifyInstance) {
  server.get('/presence', { websocket: true }, (socket: any, request: any) => {
    // Authentication below is async (DB lookups), but the client may send its
    // first heartbeat the instant its side of the socket opens -- which is
    // before an `async` handler here would reach `socket.on('message', ...)`.
    // Node's EventEmitter doesn't buffer events for listeners added after
    // they fire, so that first heartbeat would silently vanish. Attach the
    // listener synchronously, first thing, and queue anything that arrives
    // before we're authenticated and ready.
    const pending: Buffer[] = []
    let handleMessage: ((raw: Buffer) => void) | null = null
    let handleClose: (() => void) | null = null
    let closedBeforeReady = false

    socket.on('message', (raw: Buffer) => {
      if (raw.byteLength > MAX_MESSAGE_BYTES) {
        socket.close(1009, 'Message too large')
        return
      }
      if (handleMessage) handleMessage(raw)
      else if (pending.length < 2) pending.push(raw)
    })

    // Same race as the message listener above: the socket can close while
    // authentication is still pending, and a listener attached only after
    // that point would simply never see it. Attach synchronously, replay if
    // needed once we're ready.
    socket.on('close', () => {
      if (handleClose) handleClose()
      else closedBeforeReady = true
    })

    authenticateAndJoin(socket, request)
      .then((ctx) => {
        if (!ctx) return
        handleMessage = ctx.handleMessage
        handleClose = ctx.handleClose
        for (const raw of pending.splice(0)) handleMessage(raw)
        if (closedBeforeReady) handleClose()
      })
      .catch(() => {
        socket.close(1011, 'Internal error')
      })
  })
}

async function authenticateAndJoin(socket: any, request: any) {
  const token = request.cookies?.token ?? request.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    socket.close(1008, 'Unauthorized')
    return null
  }

  const session = await db.session.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date() || !session.activeTenantId) {
    socket.close(1008, 'Unauthorized')
    return null
  }

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user || user.suspendedAt) {
    socket.close(1008, 'Unauthorized')
    return null
  }

  const tenantId = session.activeTenantId
  const membership = await db.membership.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId } },
    select: { id: true },
  })
  if (!membership) {
    socket.close(1008, 'Tenant access revoked')
    return null
  }

  let usersMap = tenantPresence.get(tenantId)
  if (!usersMap) {
    usersMap = new Map()
    tenantPresence.set(tenantId, usersMap)
  }

  // Multi-tab: reuse one presence entry per user, tracking every socket that
  // user has open. The entry stays "present" as long as any one of them is
  // alive.
  let state = usersMap.get(user.id)
  if (!state) {
    state = {
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      sessions: new Map(),
      lastHeartbeat: Date.now(),
      sockets: new Set(),
    }
    usersMap.set(user.id, state)
  }
  state.sockets.add(socket)
  state.lastHeartbeat = Date.now()
  broadcast(tenantId)

  const handleMessage = (raw: Buffer) => {
    let msg: { sessions?: unknown }
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object' || !Array.isArray(msg.sessions)) return

    const parsed: SessionPresence[] = []
    for (const item of msg.sessions) {
      if (!item || typeof item !== 'object') return
      const { workSessionId, projectId, status, sessionStartedAt } = item as Record<string, unknown>
      if (typeof workSessionId !== 'string') return
      if (!VALID_SESSION_STATUSES.has(status as SessionStatus)) return
      if (projectId !== null && typeof projectId !== 'string') return
      if (typeof sessionStartedAt !== 'string' || Number.isNaN(Date.parse(sessionStartedAt))) return
      parsed.push({
        workSessionId,
        projectId: (projectId as string | null) ?? null,
        projectName: null,
        status: status as SessionStatus,
        sessionStartedAt,
      })
    }

    const current = usersMap!.get(user.id)
    if (!current) return

    current.lastHeartbeat = Date.now()
    current.sessions = new Map(parsed.map((s) => [s.workSessionId, s]))

    void (async () => {
      const stillMember = await db.membership.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        select: { id: true },
      })
      if (!stillMember) {
        current.sockets.delete(socket)
        socket.close(1008, 'Tenant access revoked')
        if (current.sockets.size === 0) usersMap!.delete(user.id)
        broadcast(tenantId)
        return
      }

      const projectIds = [...new Set(parsed.map((s) => s.projectId).filter((id): id is string => id !== null))]
      if (projectIds.length > 0) {
        const projects = await db.project.findMany({
          where: { id: { in: projectIds }, tenantId },
          select: { id: true, name: true },
        })
        const nameById = new Map(projects.map((p) => [p.id, p.name]))
        for (const s of current.sessions.values()) {
          if (s.projectId) {
            const name = nameById.get(s.projectId)
            if (name === undefined) {
              // Project no longer exists (or isn't in this tenant) -- drop
              // the stale reference rather than show a dangling projectId.
              s.projectId = null
            } else {
              s.projectName = name
            }
          }
        }
      }
      broadcast(tenantId)
    })().catch(() => {
      socket.close(1011, 'Presence update failed')
    })
  }

  const handleClose = () => {
    const current = usersMap!.get(user.id)
    if (!current) return
    current.sockets.delete(socket)
    if (current.sockets.size === 0) {
      usersMap!.delete(user.id)
      broadcast(tenantId)
    }
  }

  return { handleMessage, handleClose }
}
