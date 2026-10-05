export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN_ERROR', details, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function getErrorMessage(error, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  if (error instanceof ApiError && error.message) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
