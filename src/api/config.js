import { ApiError } from './errors'

const raw = import.meta.env ?? {}

export const apiConfig = {
  useMock: raw.VITE_USE_MOCK_API !== 'false',
  identityBaseUrl: raw.VITE_IDENTITY_API_URL?.replace(/\/$/, '') ?? '',
  bookingBaseUrl: raw.VITE_BOOKING_API_URL?.replace(/\/$/, '') ?? '',
  notificationBaseUrl: raw.VITE_NOTIFICATION_API_URL?.replace(/\/$/, '') ?? '',
  timeoutMs: Number(raw.VITE_API_TIMEOUT_MS) || 10_000,
}

export function assertRealApiConfig() {
  const missing = []
  if (!apiConfig.identityBaseUrl) missing.push('VITE_IDENTITY_API_URL')
  if (!apiConfig.bookingBaseUrl) missing.push('VITE_BOOKING_API_URL')
  if (!apiConfig.notificationBaseUrl) missing.push('VITE_NOTIFICATION_API_URL')

  if (missing.length) {
    throw new ApiError(
      `Thiếu cấu hình API: ${missing.join(', ')}. Hãy kiểm tra file .env và khởi động lại ứng dụng.`,
      { code: 'MISSING_API_CONFIG' },
    )
  }
}
