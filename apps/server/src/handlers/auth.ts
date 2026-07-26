import { GoogleAuthService } from '../services/GoogleAuthService'

const googleAuthService = new GoogleAuthService()

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
}

export async function googleAuth(request: any, reply: any) {
  const { user, token } = await googleAuthService.authenticate(request.body.credential)
  reply.setCookie('token', token, COOKIE)
  return reply.send({ data: user })
}

export async function logout(request: any, reply: any) {
  const token = request.cookies?.token ?? request.headers.authorization?.replace('Bearer ', '')
  if (token) await googleAuthService.logout(token)
  reply.clearCookie('token', { path: '/' })
  return reply.send({ data: null })
}

export async function getCurrentUser(request: any, reply: any) {
  return reply.send({ data: request.user })
}
