import { createHttpClient } from '../client'
import { apiConfig } from '../config'
import { createBookingsHttpApi } from './bookings'
import { createIdentityHttpApi } from './identity'
import { createNotificationsHttpApi } from './notifications'
import { createRoomsHttpApi } from './rooms'

export function createHttpApi(config = apiConfig) {
  const timeoutMs = config.timeoutMs ?? apiConfig.timeoutMs
  const identityRequest = createHttpClient({
    baseUrl: config.identityBaseUrl ?? '',
    timeoutMs,
  })
  const bookingRequest = createHttpClient({
    baseUrl: config.bookingBaseUrl ?? '',
    timeoutMs,
  })
  const notificationRequest = createHttpClient({
    baseUrl: config.notificationBaseUrl ?? '',
    timeoutMs,
  })

  return {
    identity: createIdentityHttpApi(identityRequest),
    rooms: createRoomsHttpApi(bookingRequest),
    bookings: createBookingsHttpApi(bookingRequest),
    notifications: createNotificationsHttpApi(notificationRequest),
  }
}

export const httpApi = createHttpApi()
