import { asCollection, encodeId, normalizeNotification } from './mapping'

function mapNotificationsCollection(payload) {
  const collection = asCollection(payload, ['notifications'])
  return { ...collection, data: collection.data.map(normalizeNotification) }
}

function failureDetails(notification, error) {
  return {
    id: notification.id,
    code: error?.code ?? 'MARK_READ_FAILED',
    status: error?.status,
    message: error?.message ?? 'Không thể đánh dấu thông báo đã đọc.',
  }
}

export function createNotificationsHttpApi(request) {
  const notificationsApi = {
    async mine() {
      const response = await request('/api/v1/notifications')
      return mapNotificationsCollection(response)
    },

    async markRead(id) {
      const response = await request(`/api/v1/notifications/${encodeId(id)}/read`, {
        method: 'PATCH',
      })
      return normalizeNotification(response)
    },

    async markAllRead() {
      const current = await notificationsApi.mine()
      const unread = current.data.filter((notification) => !notification.read)
      const settled = await Promise.allSettled(
        unread.map((notification) => notificationsApi.markRead(notification.id)),
      )
      const failures = settled.flatMap((result, index) =>
        result.status === 'rejected' ? [failureDetails(unread[index], result.reason)] : [],
      )
      const refreshed = unread.length ? await notificationsApi.mine() : current

      return {
        ...refreshed,
        attemptedCount: unread.length,
        updatedCount: unread.length - failures.length,
        failedCount: failures.length,
        failures,
      }
    },
  }

  return notificationsApi
}

export { mapNotificationsCollection }
