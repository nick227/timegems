import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './generated/types'

type ClientConfig = {
  baseUrl: string
  getToken?: () => string | null  // only for native apps; web uses httpOnly cookies
}

let _client: ReturnType<typeof createClient<paths>> | null = null
let _baseUrl: string | null = null

export function createApiClient(config: ClientConfig) {
  const client = createClient<paths>({
    baseUrl: config.baseUrl,
    credentials: 'include',  // send httpOnly session cookie automatically
  })

  if (config.getToken) {
    const authMiddleware: Middleware = {
      async onRequest({ request }) {
        const token = config.getToken!()
        if (token) request.headers.set('Authorization', `Bearer ${token}`)
        return request
      },
    }
    client.use(authMiddleware)
  }

  _client = client
  _baseUrl = config.baseUrl
  return client
}

export function getApiClient() {
  if (!_client) throw new Error('Call createApiClient() before using hooks.')
  return _client
}

// For non-REST transports (WebSocket presence) that need the API origin but
// aren't representable as an openapi-fetch call.
export function getApiBaseUrl() {
  if (!_baseUrl) throw new Error('Call createApiClient() before using hooks.')
  return _baseUrl
}

// POST /uploads bypasses the OpenAPI/glue pipeline server-side (multipart
// binary bodies don't fit AJV schema validation), so it isn't in the
// generated types either -- a plain fetch, same non-REST-escape-hatch
// precedent as getApiBaseUrl() above.
export async function uploadFile(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${getApiBaseUrl()}/uploads`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.error ?? 'Upload failed')
  }
  return response.json()
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
