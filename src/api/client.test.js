import { afterEach, describe, expect, it, vi } from 'vitest'

import { createHttpClient } from './client'
import { clearApiSession, getApiSession, setApiSession } from './session'

function response({ status, contentType, payload, jsonError }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => contentType },
    json: jsonError ? vi.fn().mockRejectedValue(jsonError) : vi.fn().mockResolvedValue(payload),
  }
}

describe('HTTP client response handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearApiSession()
  })

  it('reads the backend error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          status: 409,
          contentType: 'application/json',
          payload: {
            error: {
              code: 'ROOM_UNAVAILABLE',
              message: 'Phòng đã có khách đặt.',
              details: { roomId: 'room-1' },
            },
          },
        }),
      ),
    )

    const request = createHttpClient({ baseUrl: 'https://example.test' })
    await expect(request('/api/v1/bookings')).rejects.toMatchObject({
      status: 409,
      code: 'ROOM_UNAVAILABLE',
      message: 'Phòng đã có khách đặt.',
      details: { roomId: 'room-1' },
    })
  })

  it('clears the session for a non-JSON 401 response', async () => {
    setApiSession({ accessToken: 'expired', user: { id: 'user-1' } })
    const unauthorized = vi.fn()
    window.addEventListener('cloudstay:unauthorized', unauthorized, { once: true })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({ status: 401, contentType: 'text/plain', payload: 'Unauthorized' }),
      ),
    )

    const request = createHttpClient({ baseUrl: 'https://example.test' })
    await expect(request('/api/v1/users/me')).rejects.toMatchObject({
      status: 401,
      code: 'HTTP_401',
    })
    expect(getApiSession()).toEqual({ accessToken: null, user: null })
    expect(unauthorized).toHaveBeenCalledOnce()
  })

  it('classifies malformed JSON as an invalid response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          jsonError: new SyntaxError('Unexpected token'),
        }),
      ),
    )

    const request = createHttpClient({ baseUrl: 'https://example.test' })
    await expect(request('/api/v1/rooms')).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE',
    })
  })

  it('sends FormData directly, keeps auth and lets the browser set the multipart boundary', async () => {
    setApiSession({ accessToken: 'upload-token', user: { id: 'admin-1' } })
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        status: 201,
        contentType: 'application/json',
        payload: { data: { id: 'media-1' } },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const body = new FormData()
    body.append('file', new File(['image'], 'room.webp', { type: 'image/webp' }))
    body.append('alt_text', 'Suite cover')

    const request = createHttpClient({ baseUrl: 'https://example.test' })
    await request('/api/v1/admin/rooms/room-1/media', { method: 'POST', body })

    const options = fetchMock.mock.calls[0][1]
    expect(options.body).toBe(body)
    expect(options.headers.get('Content-Type')).toBeNull()
    expect(options.headers.get('Authorization')).toBe('Bearer upload-token')
  })

  it('can preserve entity envelope metadata for storage cleanup warnings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          status: 200,
          contentType: 'application/json',
          payload: {
            data: { id: 'media-1', deleted: true },
            storage_cleanup_pending: true,
          },
        }),
      ),
    )

    const request = createHttpClient({ baseUrl: 'https://example.test' })
    await expect(
      request('/api/v1/admin/rooms/room-1/media/media-1', {
        method: 'DELETE',
        preserveEnvelope: true,
      }),
    ).resolves.toEqual({
      data: { id: 'media-1', deleted: true },
      storage_cleanup_pending: true,
    })
  })
})
