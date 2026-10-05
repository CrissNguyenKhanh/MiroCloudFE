import { asCollection, encodeId, normalizeRoom, toApi } from './mapping'

function searchQuery(filters) {
  const { checkIn, checkOut, ...rest } = filters
  return toApi({
    ...rest,
    checkInDate: filters.checkInDate ?? checkIn,
    checkOutDate: filters.checkOutDate ?? checkOut,
  })
}

export function createRoomsHttpApi(request) {
  return {
    async search(filters = {}) {
      const response = await request('/api/v1/rooms', { query: searchQuery(filters) })
      return asCollection(response, ['rooms']).map(normalizeRoom)
    },

    async getById(id) {
      const response = await request(`/api/v1/rooms/${encodeId(id)}`)
      return normalizeRoom(response)
    },

    async adminList(filters = {}) {
      const response = await request('/api/v1/admin/rooms', { query: toApi(filters) })
      return asCollection(response, ['rooms']).map(normalizeRoom)
    },

    async create(payload) {
      const response = await request('/api/v1/admin/rooms', {
        method: 'POST',
        body: toApi(payload),
      })
      return normalizeRoom(response)
    },

    async update(id, payload) {
      const response = await request(`/api/v1/admin/rooms/${encodeId(id)}`, {
        method: 'PATCH',
        body: toApi(payload),
      })
      return normalizeRoom(response)
    },

    async toggleBookable(id, isBookable) {
      const value = typeof isBookable === 'object' ? isBookable?.isBookable : isBookable
      const response = await request(`/api/v1/admin/rooms/${encodeId(id)}`, {
        method: 'PATCH',
        body: toApi({ isBookable: value }),
      })
      return normalizeRoom(response)
    },
  }
}
