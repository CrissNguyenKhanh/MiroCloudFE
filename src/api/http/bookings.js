import { asCollection, encodeId, fromApi, normalizeBooking } from './mapping'

function setDefined(target, key, value) {
  if (value !== undefined) target[key] = value
}

function bookingBody(payload = {}) {
  const body = {}
  setDefined(body, 'room_id', payload.roomId ?? payload.room_id)
  setDefined(body, 'check_in_date', payload.checkInDate ?? payload.checkIn ?? payload.check_in_date)
  setDefined(body, 'check_out_date', payload.checkOutDate ?? payload.checkOut ?? payload.check_out_date)
  if (payload.guests !== undefined) {
    const guests = Number(payload.guests)
    setDefined(body, 'guests', Number.isFinite(guests) ? guests : payload.guests)
  }
  return body
}

function mineQuery(filters = {}) {
  const query = {}
  setDefined(query, 'status', filters.status)
  setDefined(query, 'when', filters.when)
  setDefined(query, 'page', filters.page)
  setDefined(query, 'limit', filters.limit)
  return query
}

function adminQuery(filters = {}) {
  const query = {}
  setDefined(query, 'status', filters.status)
  setDefined(query, 'room_id', filters.roomId ?? filters.room_id)
  setDefined(query, 'user_id', filters.userId ?? filters.user_id)
  setDefined(query, 'page', filters.page)
  setDefined(query, 'limit', filters.limit)
  return query
}

function reasonBody(reasonOrOptions, { required = false } = {}) {
  const raw =
    typeof reasonOrOptions === 'string' ? reasonOrOptions : reasonOrOptions?.reason
  if (typeof raw === 'string') {
    const reason = raw.trim()
    if (reason) return { reason }
  }
  return required ? { reason: raw } : undefined
}

function mapBookingsCollection(payload) {
  const collection = asCollection(payload, ['bookings'])
  return { ...collection, data: collection.data.map(normalizeBooking) }
}

export function createBookingsHttpApi(request) {
  async function cancelMine(id, reasonOrOptions) {
    const response = await request(`/api/v1/bookings/${encodeId(id)}/cancel`, {
      method: 'POST',
      body: reasonBody(reasonOrOptions),
    })
    return normalizeBooking(response)
  }

  async function cancelAdmin(id, reasonOrOptions) {
    const response = await request(`/api/v1/admin/bookings/${encodeId(id)}/cancel`, {
      method: 'POST',
      body: reasonBody(reasonOrOptions, { required: true }),
    })
    return normalizeBooking(response)
  }

  return {
    async create(payload, { idempotencyKey } = {}) {
      const response = await request('/api/v1/bookings', {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        body: bookingBody(payload),
      })
      return normalizeBooking(response)
    },

    async mine(filters = {}) {
      const response = await request('/api/v1/bookings/me', { query: mineQuery(filters) })
      return mapBookingsCollection(response)
    },

    async getById(id) {
      const response = await request(`/api/v1/bookings/${encodeId(id)}`)
      return normalizeBooking(response)
    },

    async adminList(filters = {}) {
      const response = await request('/api/v1/admin/bookings', { query: adminQuery(filters) })
      return mapBookingsCollection(response)
    },

    cancelMine,
    cancelAdmin,

    // Backwards-compatible entry point. It no longer infers the endpoint from
    // the signed-in role: callers must explicitly opt into the admin action.
    cancel(id, options = {}) {
      return options?.asAdmin || options?.admin
        ? cancelAdmin(id, options)
        : cancelMine(id, options)
    },

    async listOutbox() {
      const response = await request('/api/v1/admin/outbox')
      const collection = asCollection(response, ['events', 'outbox'])
      return { ...collection, data: collection.data.map(fromApi) }
    },

    async retryOutbox() {
      const response = await request('/api/v1/admin/outbox/retry', { method: 'POST' })
      const collection = asCollection(response, ['events', 'outbox'])
      return { ...collection, data: collection.data.map(fromApi) }
    },
  }
}

export { adminQuery, bookingBody, mineQuery, reasonBody }
