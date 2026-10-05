import { getApiSession } from '../session'
import { asCollection, encodeId, normalizeBooking, toApi } from './mapping'

function cancellationOptions(value) {
  if (typeof value === 'string') return { reason: value }
  return value ?? {}
}

export function createBookingsHttpApi(request) {
  return {
    async create(payload, { idempotencyKey } = {}) {
      const response = await request('/api/v1/bookings', {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        body: toApi(payload),
      })
      return normalizeBooking(response)
    },

    async mine(filters = {}) {
      const response = await request('/api/v1/bookings/me', { query: toApi(filters) })
      return asCollection(response, ['bookings']).map(normalizeBooking)
    },

    async getById(id) {
      const response = await request(`/api/v1/bookings/${encodeId(id)}`)
      return normalizeBooking(response)
    },

    async adminList(filters = {}) {
      const response = await request('/api/v1/admin/bookings', { query: toApi(filters) })
      return asCollection(response, ['bookings']).map(normalizeBooking)
    },

    async cancel(id, reasonOrOptions) {
      const options = cancellationOptions(reasonOrOptions)
      const role = getApiSession().user?.role?.toLowerCase()
      const asAdmin = options.asAdmin ?? options.admin ?? role === 'admin'
      const prefix = asAdmin ? '/api/v1/admin/bookings' : '/api/v1/bookings'
      const response = await request(`${prefix}/${encodeId(id)}/cancel`, {
        method: 'POST',
        body: toApi({ reason: options.reason }),
      })
      return normalizeBooking(response)
    },
  }
}
