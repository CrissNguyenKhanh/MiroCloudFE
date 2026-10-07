import { setApiSession } from "../session";
import { normalizeAuth, normalizeUser, toApi } from "./mapping";

function registrationPayload(payload = {}) {
  return {
    email: payload.email,
    password: payload.password,
    fullName: payload.fullName ?? payload.name,
  };
}

export function createIdentityHttpApi(request) {
  async function hydrateUser(session) {
    if (!session.accessToken || session.user) return session;

    // The current identity service returns only the token from login. Store it
    // before requesting /users/me so createHttpClient can attach the bearer token.
    setApiSession(session);
    const user = normalizeUser(await request("/api/v1/users/me"));
    return { ...session, user };
  }

  async function authenticate(path, payload) {
    const response = await request(path, {
      method: "POST",
      body: toApi(payload),
    });
    const session = await hydrateUser(normalizeAuth(response));
    setApiSession(session);
    return session;
  }

  return {
    async me() {
      return normalizeUser(await request("/api/v1/users/me"));
    },
    login(payload) {
      return authenticate("/api/v1/auth/login", payload);
    },

    async register(payload) {
      const response = await request("/api/v1/auth/register", {
        method: "POST",
        // The verified identity schema is strict. Keep mock-only profile fields
        // such as phone out of the real request until the backend adds them.
        body: toApi(registrationPayload(payload)),
      });
      const session = normalizeAuth(response);

      // Keep register behavior aligned with mock mode when the backend returns
      // only the new user: authenticate with the credentials just submitted.
      if (!session.accessToken && payload?.email && payload?.password) {
        return authenticate("/api/v1/auth/login", {
          email: payload.email,
          password: payload.password,
        });
      }

      const hydratedSession = await hydrateUser(session);
      setApiSession(hydratedSession);
      return hydratedSession;
    },
  };
}
