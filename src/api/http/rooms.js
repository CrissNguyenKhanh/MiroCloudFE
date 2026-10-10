import { asCollection, encodeId, fromApi, normalizeRoom } from './mapping'

function firstDefined(payload, keys) {
  for (const key of keys) {
    if (payload?.[key] !== undefined) return payload[key]
  }
  return undefined
}

function setDefined(target, key, value) {
  if (value !== undefined) target[key] = value
}

function searchQuery(filters = {}) {
  const query = {}
  setDefined(query, 'check_in', firstDefined(filters, ['checkIn', 'checkInDate', 'check_in']))
  setDefined(query, 'check_out', firstDefined(filters, ['checkOut', 'checkOutDate', 'check_out']))
  setDefined(query, 'guests', filters.guests)
  setDefined(query, 'room_type', firstDefined(filters, ['roomType', 'type', 'room_type']))
  setDefined(query, 'min_price', firstDefined(filters, ['minPrice', 'min_price']))
  setDefined(query, 'max_price', firstDefined(filters, ['maxPrice', 'max_price']))
  setDefined(query, 'page', filters.page)
  setDefined(query, 'limit', filters.limit)
  return query
}

function stayQuery(filters = {}) {
  const query = {}
  setDefined(query, 'check_in', firstDefined(filters, ['checkIn', 'checkInDate', 'check_in']))
  setDefined(query, 'check_out', firstDefined(filters, ['checkOut', 'checkOutDate', 'check_out']))
  return query
}

function unavailableQuery(filters = {}) {
  const query = {}
  setDefined(query, 'from', filters.from)
  setDefined(query, 'to', filters.to)
  return query
}

function alternativesQuery(filters = {}) {
  return { ...stayQuery(filters), ...(filters.guests === undefined ? {} : { guests: filters.guests }) }
}

// Backend room schemas are strict. This is deliberately an allow-list rather
// than a generic camelCase -> snake_case conversion.
function adminRoomBody(payload = {}) {
  const body = {}
  setDefined(body, 'room_number', firstDefined(payload, ['roomNumber', 'room_number']))
  setDefined(body, 'name', payload.name)
  setDefined(body, 'room_type', firstDefined(payload, ['roomType', 'type', 'room_type']))
  setDefined(body, 'price_per_night', firstDefined(payload, ['pricePerNight', 'price_per_night']))
  setDefined(body, 'capacity', payload.capacity)
  setDefined(body, 'size_sqm', firstDefined(payload, ['sizeSqm', 'size', 'size_sqm']))
  setDefined(body, 'bed_type', firstDefined(payload, ['bedType', 'bed', 'bed_type']))
  setDefined(body, 'view_label', firstDefined(payload, ['viewLabel', 'view', 'view_label']))
  setDefined(body, 'floor', payload.floor)
  setDefined(body, 'featured', payload.featured)
  setDefined(body, 'description', payload.description)
  setDefined(body, 'palette', payload.palette)
  setDefined(body, 'equipment', firstDefined(payload, ['equipment', 'amenities']))
  setDefined(body, 'active', firstDefined(payload, ['active', 'isBookable']))
  return body
}

function mapRoomsCollection(payload, keys = ['rooms']) {
  const collection = asCollection(payload, keys)
  return { ...collection, data: collection.data.map(normalizeRoom) }
}

function normalizeAlternatives(payload) {
  const alternatives = fromApi(payload) ?? {}
  return {
    ...alternatives,
    otherRooms: Array.isArray(alternatives.otherRooms)
      ? alternatives.otherRooms.map(normalizeRoom)
      : [],
  }
}

export function createRoomsHttpApi(request) {
  async function listActive() {
    return mapRoomsCollection(await request('/api/v1/rooms'))
  }

  return {
    list: listActive,

    async search(filters = {}) {
      const response = await request('/api/v1/rooms/search', { query: searchQuery(filters) })
      return mapRoomsCollection(response)
    },

    async getById(id, filters = {}) {
      const response = await request(`/api/v1/rooms/${encodeId(id)}`, {
        query: stayQuery(filters),
      })
      return normalizeRoom(response)
    },

    async unavailableDates(id, filters = {}) {
      const response = await request(`/api/v1/rooms/${encodeId(id)}/unavailable-dates`, {
        query: unavailableQuery(filters),
      })
      return fromApi(response)
    },

    async alternatives(id, filters = {}) {
      const response = await request(`/api/v1/rooms/${encodeId(id)}/alternatives`, {
        query: alternativesQuery(filters),
      })
      return normalizeAlternatives(response)
    },

    async adminList() {
      return mapRoomsCollection(await request('/api/v1/admin/rooms'))
    },

    async create(payload) {
      const response = await request('/api/v1/admin/rooms', {
        method: 'POST',
        body: adminRoomBody(payload),
      })
      return normalizeRoom(response)
    },

    async update(id, payload) {
      const response = await request(`/api/v1/admin/rooms/${encodeId(id)}`, {
        method: 'PATCH',
        body: adminRoomBody(payload),
      })
      return normalizeRoom(response)
    },

    async toggleBookable(id, requestedValue) {
      const active =
        typeof requestedValue === 'object' && requestedValue !== null
          ? firstDefined(requestedValue, ['active', 'isBookable'])
          : requestedValue
      const response = await request(`/api/v1/admin/rooms/${encodeId(id)}`, {
        method: 'PATCH',
        body: { active },
      })
      return normalizeRoom(response)
    },
  }
}

export { adminRoomBody, searchQuery, stayQuery }
