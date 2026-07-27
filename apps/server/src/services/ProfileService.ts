import { db } from '@timegems/db'
import { HttpError } from '../lib/errors'
import { syncPersonalTenantName } from '../lib/provisionTenant'

export class ProfileService {
  async updateName(userId: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) throw new HttpError(400, 'Name is required')

    const current = await db.user.findUnique({ where: { id: userId } })
    if (!current) throw new HttpError(404, 'User not found')

    const user = await db.user.update({
      where: { id: userId },
      data: { name: trimmed },
    })

    await syncPersonalTenantName(userId, current.name, trimmed)
    return user
  }
}
