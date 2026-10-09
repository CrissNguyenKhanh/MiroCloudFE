import { setApiSession } from "../session";
import { asCollection, encodeId, normalizeAuth, normalizeUser, toApi } from "./mapping";

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

      // The current backend deliberately returns the created user, not a
      // token. Do not chain an implicit login: if that second request failed,
      // callers could incorrectly retry registration even though it committed.
      if (!session.accessToken) {
        return {
          accessToken: null,
          user: session.user ?? normalizeUser(response),
          registrationSucceeded: true,
          requiresLogin: true,
        };
      }

      const hydratedSession = await hydrateUser(session);
      setApiSession(hydratedSession);
      return {
        ...hydratedSession,
        registrationSucceeded: true,
        requiresLogin: false,
      };
    },

    async adminListUsers() {
      const collection = asCollection(await request("/api/v1/admin/users"), ["users"]);
      return { ...collection, data: collection.data.map(normalizeUser) };
    },

    async updateUserStatus(id, status) {
      const value = typeof status === "object" ? status?.status : status;
      return normalizeUser(
        await request(`/api/v1/admin/users/${encodeId(id)}/status`, {
          method: "PATCH",
          body: { status: typeof value === "string" ? value.toUpperCase() : value },
        }),
      );
    },
  };
}
