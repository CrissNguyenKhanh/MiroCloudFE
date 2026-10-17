import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listForRoom: vi.fn() }));
vi.mock("./index", () => ({ api: { media: mocks } }));

import {
  clearRoomMediaCache,
  invalidateRoomMedia,
  loadRoomMedia,
  ROOM_MEDIA_MAX_CONCURRENT,
} from "./mediaCache";

describe("room media cache", () => {
  beforeEach(() => {
    clearRoomMediaCache();
    mocks.listForRoom.mockReset();
  });

  it("deduplicates pending/cached requests and refreshes after invalidation", async () => {
    mocks.listForRoom.mockResolvedValue({ data: [{ id: "media-1" }] });

    const [first, duplicate] = await Promise.all([
      loadRoomMedia("room-1"),
      loadRoomMedia("room-1"),
    ]);
    expect(first).toEqual(duplicate);
    await loadRoomMedia("room-1");
    expect(mocks.listForRoom).toHaveBeenCalledTimes(1);

    invalidateRoomMedia("room-1");
    await loadRoomMedia("room-1");
    expect(mocks.listForRoom).toHaveBeenCalledTimes(2);
  });

  it("limits concurrent per-room requests", async () => {
    let active = 0;
    let maxActive = 0;
    let started = 0;
    const releases = [];
    mocks.listForRoom.mockImplementation(
      () =>
        new Promise((resolve) => {
          active += 1;
          started += 1;
          maxActive = Math.max(maxActive, active);
          releases.push(() => {
            active -= 1;
            resolve({ data: [] });
          });
        }),
    );

    const requests = Array.from({ length: 7 }, (_, index) =>
      loadRoomMedia(`room-${index}`),
    );
    await vi.waitFor(() => expect(releases).toHaveLength(ROOM_MEDIA_MAX_CONCURRENT));

    while (started < requests.length) {
      const previousStarted = started;
      releases.shift()();
      await vi.waitFor(() =>
        expect(started).toBeGreaterThan(previousStarted),
      );
    }
    releases.forEach((release) => release());
    await Promise.all(requests);

    expect(maxActive).toBe(ROOM_MEDIA_MAX_CONCURRENT);
  });
});
