import { asCollection, encodeId, normalizeNotification, toApi } from './mapping'

export function createNotificationsHttpApi(request) {
  const notificationsApi = {
    async mine(filters = {}) {
      const response = await request('/api/v1/notifications', { query: toApi(filters) })
      return asCollection(response, ['notifications']).map(normalizeNotification)
    },

    async markRead(id) {
      const response = await request(`/api/v1/notifications/${encodeId(id)}/read`, {
        method: 'PATCH',
      })
      return normalizeNotification(response)
    },

    async markAllRead() {
      try {
        const response = await request('/api/v1/notifications/read-all', {
          method: 'PATCH',
        })
        if (response === null || response === undefined) return notificationsApi.mine()
        try {
          return asCollection(response, [
            'notifications',
            'updated',
            'updatedNotifications',
          ]).map(normalizeNotification)
        } catch (error) {
          if (error?.code !== 'INVALID_RESPONSE') throw error
          return notificationsApi.mine()
        }
      } catch (error) {
        if (error?.status !== 404 && error?.status !== 405) throw error

        // Compatibility path for the verified backend, which currently only
        // exposes the per-notification read endpoint.
        const notifications = await notificationsApi.mine()
        await Promise.all(
          notifications
            .filter((notification) => !notification.read)
            .map((notification) => notificationsApi.markRead(notification.id)),
        )
        return notificationsApi.mine()
      }
    },
  }

  return notificationsApi
}
