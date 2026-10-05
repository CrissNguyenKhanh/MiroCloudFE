import { ApiError } from './errors'
import { clearApiSession, getApiSession } from './session'

function buildUrl(baseUrl, path, query) {
  const url = new URL(`${baseUrl}${path}`)
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
}

function humanMessage(status, payload) {
  if (typeof payload?.message === 'string') return payload.message
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (status === 409) return 'Phòng vừa được khách khác đặt trong khoảng thời gian này.'
  if (status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
  return 'Yêu cầu không thể hoàn tất.'
}

function announceUnauthorized() {
  clearApiSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cloudstay:unauthorized'))
  }
}

export function createHttpClient({ baseUrl, timeoutMs = 10_000 }) {
  return async function request(path, options = {}) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const token = getApiSession().accessToken
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')
    if (options.body !== undefined) headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    try {
      const response = await fetch(buildUrl(baseUrl, path, options.query), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') ?? ''
      let payload = null
      if (response.status === 401) announceUnauthorized()

      if (response.status !== 204) {
        if (!contentType.toLowerCase().includes('json')) {
          if (!response.ok) {
            throw new ApiError(humanMessage(response.status, null), {
              status: response.status,
              code: `HTTP_${response.status}`,
            })
          }
          throw new ApiError('Máy chủ trả về dữ liệu không đúng định dạng JSON.', {
            status: response.status,
            code: 'INVALID_RESPONSE',
          })
        }
        try {
          payload = await response.json()
        } catch (cause) {
          throw new ApiError('Máy chủ trả về dữ liệu JSON không hợp lệ.', {
            status: response.status,
            code: 'INVALID_RESPONSE',
            cause,
          })
        }
      }

      if (!response.ok) {
        const errorPayload = payload?.error ?? payload
        throw new ApiError(humanMessage(response.status, errorPayload), {
          status: response.status,
          code: errorPayload?.code ?? `HTTP_${response.status}`,
          details: errorPayload?.details ?? payload,
        })
      }

      return payload?.data ?? payload
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error?.name === 'AbortError') {
        throw new ApiError('Yêu cầu mất quá nhiều thời gian. Chưa thể xác nhận thao tác đã thành công.', {
          code: 'TIMEOUT',
          cause: error,
        })
      }
      throw new ApiError('Không thể kết nối tới máy chủ. Hãy kiểm tra mạng rồi thử lại.', {
        code: 'NETWORK_ERROR',
        cause: error,
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}
