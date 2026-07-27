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

interface PresenceState {
  userId: string
  name: string
  avatarUrl: string | null
  status: Status
  projectId: string | null
  projectName: string | null
  sessionStartedAt: string | null
  lastHeartbeat: number
  sockets: Set<any>
}

const STALE_MS = 45_000 // ~3 missed 15s heartbeats before we call it offline
const SWEEP_INTERVAL_MS = 10_000
const MAX_MESSAGE_BYTES = 4 * 1024
const VALID_STATUSES = new Set<Status>(['online', 'working', 'paused'])

// tenantId -> userId -> state
const tenantPresence = new Map<string, Map<string, PresenceState>>()

function serialize(state: PresenceState) {
  const { sockets, ...rest } = state
  return rest
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
      status: 'online',
      projectId: null,
      projectName: null,
      sessionStartedAt: null,
      lastHeartbeat: Date.now(),
      sockets: new Set(),
    }
    usersMap.set(user.id, state)
  }
  state.sockets.add(socket)
  state.lastHeartbeat = Date.now()
  broadcast(tenantId)

  const handleMessage = (raw: Buffer) => {
    let msg: { status?: unknown; projectId?: unknown; sessionStartedAt?: unknown }
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object') return
    if (msg.status !== undefined && !VALID_STATUSES.has(msg.status as Status)) return
    if (msg.projectId !== undefined && msg.projectId !== null && typeof msg.projectId !== 'string') return
    if (
      msg.sessionStartedAt !== undefined &&
      msg.sessionStartedAt !== null &&
      (typeof msg.sessionStartedAt !== 'string' || Number.isNaN(Date.parse(msg.sessionStartedAt)))
    ) {
      return
    }

    const current = usersMap!.get(user.id)
    if (!current) return

    current.status = (msg.status as Status | undefined) ?? current.status
    current.projectId = (msg.projectId as string | null | undefined) ?? null
    current.sessionStartedAt = (msg.sessionStartedAt as string | null | undefined) ?? null
    current.lastHeartbeat = Date.now()

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

      if (current.projectId) {
        const project = await db.project.findFirst({
          where: { id: current.projectId, tenantId },
          select: { name: true },
        })
        if (!project) current.projectId = null
        current.projectName = project?.name ?? null
      } else {
        current.projectName = null
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
