import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiBaseUrl } from '../client'

export type PresenceStatus = 'online' | 'working' | 'paused'

export interface PresenceEntry {
  userId: string
  name: string
  avatarUrl: string | null
  status: PresenceStatus
  projectId: string | null
  projectName: string | null
  sessionStartedAt: string | null
  lastHeartbeat: number
}

export interface PresenceReport {
  status: PresenceStatus
  projectId?: string | null
  sessionStartedAt?: string | null
}

const HEARTBEAT_MS = 15_000
const RECONNECT_MS = 2_000

// One shared connection per browser tab, reused across every component that
// calls usePresenceConnection/usePresenceList -- there is exactly one
// WebSocket regardless of how many components are mounted.
let socket: WebSocket | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let latestReport: PresenceReport = { status: 'online' }
let listeners = 0

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

  useEffect(() => {
    latestReport = report
    send()
  }, [report.status, report.projectId, report.sessionStartedAt])

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
