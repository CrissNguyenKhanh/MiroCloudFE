import { api } from "./index";

export const ROOM_MEDIA_CACHE_TTL_MS = 60_000;
export const ROOM_MEDIA_MAX_CONCURRENT = 4;

const cache = new Map();
const queue = [];
let activeRequests = 0;

function drainQueue() {
  while (activeRequests < ROOM_MEDIA_MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift();
    activeRequests += 1;
    Promise.resolve()
      .then(next.task)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeRequests -= 1;
        drainQueue();
      });
  }
}

function schedule(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    drainQueue();
  });
}

export function loadRoomMedia(roomId, { force = false } = {}) {
  const key = String(roomId ?? "");
  if (!key) return Promise.resolve([]);

  const existing = cache.get(key);
  if (existing?.promise) return existing.promise;
  if (
    !force &&
    existing?.data &&
    Date.now() - existing.cachedAt < ROOM_MEDIA_CACHE_TTL_MS
  ) {
    return Promise.resolve(existing.data);
  }

  const entry = { promise: null };
  entry.promise = schedule(() => api.media.listForRoom(key))
    .then((result) => {
      const data = Array.isArray(result?.data) ? result.data : [];
      if (cache.get(key) === entry) {
        cache.set(key, { data, cachedAt: Date.now() });
      }
      return data;
    })
    .catch((error) => {
      if (cache.get(key) === entry) cache.delete(key);
      throw error;
    });
  cache.set(key, entry);
  return entry.promise;
}

export function invalidateRoomMedia(roomId) {
  cache.delete(String(roomId ?? ""));
}

export function clearRoomMediaCache() {
  cache.clear();
}
