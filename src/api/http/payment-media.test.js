import { afterEach, describe, expect, it, vi } from "vitest";

import { createHttpApi } from "./index";

function jsonResponse(payload, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => "application/json; charset=utf-8" },
    json: vi.fn().mockResolvedValue(payload),
  };
}

function createApi() {
  return createHttpApi({
    identityBaseUrl: "https://identity.test",
    bookingBaseUrl: "https://booking.test",
    notificationBaseUrl: "https://notification.test",
    timeoutMs: 1000,
  });
}

describe("payment and media HTTP contracts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates MOCK payment with only provider and the supplied idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          data: {
            id: "payment-1",
            booking_id: "booking-1",
            provider: "MOCK",
            amount: 2_000_000,
            currency: "VND",
            status: "SUCCEEDED",
          },
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const payment = await createApi().payments.create("booking-1", {
      idempotencyKey: "payment-intent-123",
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/v1/bookings/booking-1/payments");
    expect(options.headers.get("Idempotency-Key")).toBe("payment-intent-123");
    expect(JSON.parse(options.body)).toEqual({ provider: "MOCK" });
    expect(payment).toMatchObject({
      bookingId: "booking-1",
      amount: 2_000_000,
      status: "succeeded",
    });
  });

  it("uploads multipart media and preserves cleanup metadata on replace/delete", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "media-1",
            room_id: "room-1",
            media_type: "image",
            url: "https://cdn.test/room.webp",
            alt_text: "Suite cover",
            sort_order: 1,
            is_cover: true,
          },
        }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "media-1",
            room_id: "room-1",
            media_type: "video",
            url: "https://cdn.test/room.webm",
            sort_order: 1,
            is_cover: false,
          },
          storage_cleanup_pending: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { id: "media-1", deleted: true },
          storage_cleanup_pending: false,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = createApi().media;
    const image = new File(["image"], "room.webp", { type: "image/webp" });
    const video = new File(["video"], "room.webm", { type: "video/webm" });

    await expect(api.upload("room-1", { file: image, altText: "Suite cover" }))
      .resolves.toMatchObject({ id: "media-1", mediaType: "image", isCover: true });
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData);
    expect(fetchMock.mock.calls[0][1].headers.get("Content-Type")).toBeNull();

    await expect(api.replaceFile("room-1", "media-1", { file: video }))
      .resolves.toMatchObject({
        data: { id: "media-1", mediaType: "video", isCover: false },
        storageCleanupPending: true,
      });
    await expect(api.remove("room-1", "media-1")).resolves.toEqual({
      data: expect.objectContaining({ id: "media-1", deleted: true }),
      storageCleanupPending: false,
    });
  });
});
