let apiSession = {
  accessToken: null,
  user: null,
}

export function setApiSession(session = {}) {
  apiSession = {
    accessToken: session.accessToken ?? null,
    user: session.user ?? null,
  }
}

export function clearApiSession() {
  apiSession = { accessToken: null, user: null }
}

export function getApiSession() {
  return apiSession
}
