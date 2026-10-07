const TOKEN_KEY = "cloudstay.access-token.v1";

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function isTokenExpired(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === "number" && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function getStoredAccessToken() {
  const token = readStoredToken();
  if (!token) return null;
  if (isTokenExpired(token)) {
    writeStoredToken(null);
    return null;
  }
  return token;
}

let apiSession = {
  accessToken: getStoredAccessToken(),
  user: null,
};

export function setApiSession(session = {}) {
  apiSession = {
    accessToken: session.accessToken ?? null,
    user: session.user ?? null,
  };
  writeStoredToken(apiSession.accessToken);
}

export function clearApiSession() {
  apiSession = { accessToken: null, user: null };
  writeStoredToken(null);
}

export function getApiSession() {
  return apiSession;
}
