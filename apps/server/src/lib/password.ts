import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

// A real hash of an arbitrary, never-used password -- exists only so
// EmailAuthService.login can run a bcrypt compare against *something* when
// no user/hash exists, keeping the response time close to a real
// wrong-password attempt. Without this, "no such email" returns
// near-instantly while "wrong password" takes bcrypt's ~100ms, and that gap
// is itself an account-enumeration channel.
export const DUMMY_PASSWORD_HASH = '$2a$10$OkvuBO/VNNfZehJeHd8lzOHjS/OBS.WJD/.LTIfXJf38aGarxrhS.'

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}
