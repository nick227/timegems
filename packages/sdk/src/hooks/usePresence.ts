import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiBaseUrl } from '../client'

export type PresenceStatus = 'online' | 'working' | 'paused'
export type PresenceSessionStatus = 'working' | 'paused'

// What the client reports for one of the user's concurrently active
// sessions (one per project -- see UserActiveSession server-side).
export interface PresenceSessionReport {
  workSessionId: string
  projectId: string | null
  status: PresenceSessionStatus
  sessionStartedAt: string
}

export interface PresenceSessionEntry extends PresenceSessionReport {
  projectName: string | null
}

export interface PresenceEntry {
  userId: string
  name: string
  avatarUrl: string | null
  // Derived "primary" session (a working one wins over a paused one) for
  // single-value UI that doesn't yet care which of several sessions is
  // "the" one -- see `sessions` for the full per-session breakdown, needed
  // by anything that has to know presence within one specific project/room.
  status: PresenceStatus
  projectId: string | null
  projectName: string | null
  sessionStartedAt: string | null
  lastHeartbeat: number
  sessions: PresenceSessionEntry[]
}

export interface PresenceReport {
  sessions: PresenceSessionReport[]
}

// Pushed over the same shared socket whenever anyone adds a note to a
// session tagged with a given project (see broadcastProjectNote/
// presence.ts server-side) -- the live half of a project "room". Not a
// per-session report the client sends; only ever received.
export interface ProjectNoteEvent {
  type: 'project-note'
  projectId: string
  workSessionId: string
  note: {
    id: string
    body: string
    createdAt: string
    updatedAt: string
    author: { id: string; name: string; avatarUrl: string | null }
  }
}

export interface ProjectActivityEvent {
  type: 'project-activity'
  projectId: string
  item: import('../generated/types').components['schemas']['ProjectFeedItem']
}

const HEARTBEAT_MS = 15_000
const RECONNECT_MS = 2_000

// One shared connection per browser tab, reused across every component that
// calls usePresenceConnection/usePresenceList -- there is exactly one
// WebSocket regardless of how many components are mounted.
let socket: WebSocket | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let latestReport: PresenceReport = { sessions: [] }
let listeners = 0

// Separate from the single presence onEntries callback above: any number of
// components (not just the one Shell-mounted usePresenceConnection call) can
// want project-note events, each for a different project, so this is a
// plain subscriber set rather than a single fixed callback.
const projectNoteListeners = new Set<(event: ProjectNoteEvent) => void>()
const projectActivityListeners = new Set<(event: ProjectActivityEvent) => void>()

function send() {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(latestReport))
  }
}

function connect(onEntries: (entries: PresenceEntry[]) => void) {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return

  const wsUrl = getApiBaseUrl().replace(/^http/, 'ws') + '/presence'
  socket = new WebSocket(wsUrl)

  socket.onopen = () => {
    send()
    heartbeatTimer = setInterval(send, HEARTBEAT_MS)
  }
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'presence') onEntries(data.entries)
      else if (data.type === 'project-note') {
        for (const listener of projectNoteListeners) listener(data as ProjectNoteEvent)
      } else if (data.type === 'project-activity') {
        for (const listener of projectActivityListeners) listener(data as ProjectActivityEvent)
      }
    } catch {
      // ignore malformed frames
    }
  }
  socket.onclose = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    socket = null
    if (listeners > 0) {
      reconnectTimer = setTimeout(() => connect(onEntries), RECONNECT_MS)
    }
  }
}

function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  socket?.close()
  socket = null
}

// Call once near the root of the authenticated app (Shell) with the current
// user's own state -- this both reports presence and keeps the shared socket
// alive so usePresenceList() elsewhere has something to read.
export function usePresenceConnection(report: PresenceReport) {
  const queryClient = useQueryClient()
  const reportRef = useRef(report)
  reportRef.current = report
  // `report.sessions` is a plain array a caller typically rebuilds every
  // render -- comparing its serialized form (small, capped by how many
  // concurrent sessions a user can realistically have) avoids re-sending on
  // every render when nothing actually changed.
  const serializedSessions = JSON.stringify(report.sessions)

  useEffect(() => {
    latestReport = report
    send()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serializedSessions is the real dependency; report itself is intentionally excluded to avoid re-sending on every render
  }, [serializedSessions])

  useEffect(() => {
    listeners += 1
    connect((entries) => {
      queryClient.setQueryData(['presence'], entries)
    })
    return () => {
      listeners -= 1
      if (listeners <= 0) disconnect()
    }
  }, [queryClient])
}

// Read-only subscription to the live presence list -- safe to call from any
// number of components (Team page, etc.) without opening extra sockets.
export function usePresenceList(): PresenceEntry[] {
  const { data } = useQuery<PresenceEntry[]>({
    queryKey: ['presence'],
    queryFn: () => Promise.resolve([]),
    enabled: false,
    initialData: [],
    staleTime: Infinity,
  })
  return data
}

// Subscribes to live note activity for one project's "room" -- called
// whenever anyone (any concurrent session on that project, including the
// caller's own other tabs) adds a note there. Reuses presence's already-open
// shared socket rather than opening a second connection; requires
// usePresenceConnection to be mounted somewhere (Shell) to keep that socket
// alive, same as usePresenceList. `projectId` of `null`/`undefined` simply
// subscribes to nothing (an unassigned session has no room).
export function useProjectNoteEvents(projectId: string | null | undefined, onNote: (event: ProjectNoteEvent) => void) {
  const onNoteRef = useRef(onNote)
  onNoteRef.current = onNote

  useEffect(() => {
    if (!projectId) return
    const listener = (event: ProjectNoteEvent) => {
      if (event.projectId === projectId) onNoteRef.current(event)
    }
    projectNoteListeners.add(listener)
    return () => {
      projectNoteListeners.delete(listener)
    }
  }, [projectId])
}

export function useProjectActivityEvents(
  projectId: string | null | undefined,
  onActivity: (event: ProjectActivityEvent) => void,
) {
  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity

  useEffect(() => {
    if (!projectId) return
    const listener = (event: ProjectActivityEvent) => {
      if (event.projectId === projectId) onActivityRef.current(event)
    }
    projectActivityListeners.add(listener)
    return () => {
      projectActivityListeners.delete(listener)
    }
  }, [projectId])
}
