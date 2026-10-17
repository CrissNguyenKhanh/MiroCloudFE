import { encodeId, normalizePayment } from "./mapping";

export function createPaymentsHttpApi(request) {
  return {
    async create(bookingId, { idempotencyKey, provider = "MOCK" } = {}) {
      const response = await request(
        `/api/v1/bookings/${encodeId(bookingId)}/payments`,
        {
          method: "POST",
          headers: idempotencyKey
            ? { "Idempotency-Key": idempotencyKey }
            : undefined,
          body: { provider },
        },
      );
      return normalizePayment(response);
    },

    async getForBooking(bookingId) {
      const response = await request(
        `/api/v1/bookings/${encodeId(bookingId)}/payment`,
      );
      return normalizePayment(response);
    },
  };
}
