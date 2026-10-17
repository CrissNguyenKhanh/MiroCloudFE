import { asCollection, encodeId, normalizeReview, normalizeReviewSummary } from './mapping'

function setDefined(target, key, value) {
  if (value !== undefined) target[key] = value
}

function pageQuery(filters = {}) {
  const query = {}
  setDefined(query, 'page', filters.page)
  setDefined(query, 'limit', filters.limit)
  return query
}

function roomReviewsQuery(filters = {}) {
  return { ...(filters.rating ? { rating: filters.rating } : {}), ...pageQuery(filters) }
}

function adminReviewsQuery(filters = {}) {
  const query = {}
  setDefined(query, 'status', filters.status)
  setDefined(query, 'room_id', filters.roomId ?? filters.room_id)
  if (filters.rating) query.rating = filters.rating
  return { ...query, ...pageQuery(filters) }
}

// Backend review schemas are strict: allow-list instead of generic conversion.
// `display_name` is stored as `reviewer_name` and returned as `reviewerName`.
function reviewBody(payload = {}) {
  const body = {}
  if (payload.rating !== undefined) body.rating = Number(payload.rating)
  setDefined(body, 'title', payload.title)
  setDefined(body, 'comment', payload.comment)
  setDefined(body, 'display_name', payload.displayName ?? payload.display_name ?? payload.reviewerName)
  return body
}

function mapReviewsCollection(payload) {
  const collection = asCollection(payload, ['reviews'])
  return { ...collection, data: collection.data.map(normalizeReview) }
}

export function createReviewsHttpApi(request) {
  return {
    // Public: only VISIBLE reviews, plus a summary computed over all visible reviews.
    async listForRoom(roomId, filters = {}) {
      const response = await request(`/api/v1/rooms/${encodeId(roomId)}/reviews`, {
        query: roomReviewsQuery(filters),
      })
      return { ...mapReviewsCollection(response), summary: normalizeReviewSummary(response?.summary) }
    },

    async mine(filters = {}) {
      const response = await request('/api/v1/reviews/me', { query: pageQuery(filters) })
      return mapReviewsCollection(response)
    },

    async getForBooking(bookingId) {
      const response = await request(`/api/v1/bookings/${encodeId(bookingId)}/review`)
      return normalizeReview(response)
    },

    async create(bookingId, payload) {
      const response = await request(`/api/v1/bookings/${encodeId(bookingId)}/review`, {
        method: 'POST',
        body: reviewBody(payload),
      })
      return normalizeReview(response)
    },

    async update(reviewId, payload) {
      const response = await request(`/api/v1/reviews/${encodeId(reviewId)}`, {
        method: 'PATCH',
        body: reviewBody(payload),
      })
      return normalizeReview(response)
    },

    async remove(reviewId) {
      await request(`/api/v1/reviews/${encodeId(reviewId)}`, { method: 'DELETE' })
    },

    async adminList(filters = {}) {
      const response = await request('/api/v1/admin/reviews', { query: adminReviewsQuery(filters) })
      return mapReviewsCollection(response)
    },

    async adminSetStatus(reviewId, status) {
      const response = await request(`/api/v1/admin/reviews/${encodeId(reviewId)}/status`, {
        method: 'PATCH',
        body: { status: String(status).toUpperCase() },
      })
      return normalizeReview(response)
    },
  }
}

export { adminReviewsQuery, reviewBody, roomReviewsQuery }
