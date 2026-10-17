import { beforeEach, describe, expect, it } from "vitest";

import { addDays, todayISO } from "../utils/date";
import { api, isMockMode, resetMockDemo } from "./index";

const GUEST_CREDENTIALS = {
  email: "guest@cloudstay.vn",
  password: "Guest123!",
};

const ADMIN_CREDENTIALS = {
  email: "admin@cloudstay.vn",
  password: "Admin123!",
};

function futureStay(offset = 30) {
  const checkInDate = addDays(todayISO(), offset);
  const checkOutDate = addDays(checkInDate, 3);
  return { checkInDate, checkOutDate };
}

async function loginAsGuest() {
  const session = await api.identity.login(GUEST_CREDENTIALS);
  expect(session).toMatchObject({
    accessToken: expect.any(String),
    user: { id: "user-guest", role: "customer" },
  });
  return session;
}

describe("mock API booking lifecycle", () => {
  beforeEach(async () => {
    await resetMockDemo();
  });

  it("books an available room, lists it for the current user, then restores availability on cancel", async () => {
    expect(isMockMode).toBe(true);
    await loginAsGuest();

    const { checkInDate, checkOutDate } = futureStay();
    const search = { checkIn: checkInDate, checkOut: checkOutDate, guests: 2 };
    const initiallyAvailable = await api.rooms.search(search);
    const room = initiallyAvailable.data.find(
      (candidate) => candidate.capacity >= 2,
    );

    expect(initiallyAvailable.meta).toMatchObject({
      page: 1,
      total: expect.any(Number),
    });

    expect(room).toBeDefined();

    const booking = await api.bookings.create(
      { roomId: room.id, checkInDate, checkOutDate, guests: 2 },
      { idempotencyKey: "flow-booking-key" },
    );

    expect(booking).toMatchObject({
      roomId: room.id,
      checkInDate,
      checkOutDate,
      guests: 2,
      nights: 3,
      nightlyRate: room.pricePerNight,
      totalPrice: room.pricePerNight * 3,
      status: "confirmed",
    });

    const mine = await api.bookings.mine();
    expect(mine.data).toContainEqual(
      expect.objectContaining({ id: booking.id, roomId: room.id }),
    );

    const unavailable = await api.rooms.search(search);
    expect(unavailable.data.some((candidate) => candidate.id === room.id)).toBe(
      false,
    );

    const adjacentStay = await api.rooms.search({
      checkIn: checkOutDate,
      checkOut: addDays(checkOutDate, 1),
      guests: 2,
    });
    expect(
      adjacentStay.data.some((candidate) => candidate.id === room.id),
    ).toBe(true);

    const cancelled = await api.bookings.cancelMine(booking.id, {
      reason: "Thay đổi kế hoạch",
    });
    expect(cancelled).toMatchObject({ id: booking.id, status: "cancelled" });

    const mineAfterCancel = await api.bookings.mine();
    expect(mineAfterCancel.data).toContainEqual(
      expect.objectContaining({ id: booking.id, status: "cancelled" }),
    );

    const availableAgain = await api.rooms.search(search);
    expect(
      availableAgain.data.some((candidate) => candidate.id === room.id),
    ).toBe(true);
  });

  it("replays the same idempotency key without duplication and rejects a new overlapping booking with 409", async () => {
    await loginAsGuest();

    const { checkInDate, checkOutDate } = futureStay(40);
    const room = (
      await api.rooms.search({
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: 1,
      })
    ).data[0];
    const payload = { roomId: room.id, checkInDate, checkOutDate, guests: 1 };

    const created = await api.bookings.create(payload, {
      idempotencyKey: "stable-retry-key",
    });
    const replayed = await api.bookings.create(payload, {
      idempotencyKey: "stable-retry-key",
    });

    expect(replayed.id).toBe(created.id);
    await expect(
      api.bookings.create(
        { ...payload, guests: 2 },
        { idempotencyKey: "stable-retry-key" },
      ),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_KEY_REUSED" });

    const matchingBookings = (await api.bookings.mine()).data.filter(
      (booking) => booking.id === created.id,
    );
    expect(matchingBookings).toHaveLength(1);

    await expect(
      api.bookings.create(
        {
          ...payload,
          checkInDate: addDays(checkInDate, 1),
          checkOutDate: addDays(checkOutDate, 1),
        },
        { idempotencyKey: "overlap-conflict-key" },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("creates booking notifications and marks one or all as read", async () => {
    await loginAsGuest();
    const { checkInDate, checkOutDate } = futureStay(50);
    const room = (
      await api.rooms.search({
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: 1,
      })
    ).data[0];

    await api.bookings.create(
      { roomId: room.id, checkInDate, checkOutDate, guests: 1 },
      { idempotencyKey: "notification-booking-key" },
    );

    const notifications = await api.notifications.mine();
    const bookingNotification = notifications.data.find(
      (notification) => notification.type === "booking_confirmed",
    );
    expect(bookingNotification).toMatchObject({ read: false });

    await expect(
      api.notifications.markRead(bookingNotification.id),
    ).resolves.toMatchObject({
      id: bookingNotification.id,
      read: true,
    });
    const markAllResult = await api.notifications.markAllRead();
    expect(markAllResult).toMatchObject({ failedCount: 0 });
    expect((await api.notifications.mine()).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ read: true })]),
    );
    expect(
      (await api.notifications.mine()).data.every(
        (notification) => notification.read,
      ),
    ).toBe(true);
  });

  it("supports admin room creation, editing and booking toggle", async () => {
    const session = await api.identity.login(ADMIN_CREDENTIALS);
    expect(session.user.role).toBe("admin");

    const created = await api.rooms.create({
      roomNumber: "1501",
      name: "Test Penthouse",
      type: "suite",
      pricePerNight: 4_200_000,
      capacity: 3,
      amenities: ["Wi-Fi"],
    });
    expect((await api.rooms.adminList()).data).toContainEqual(
      expect.objectContaining({ id: created.id, roomNumber: "1501" }),
    );

    await expect(
      api.rooms.update(created.id, {
        pricePerNight: 4_500_000,
        featured: true,
      }),
    ).resolves.toMatchObject({ pricePerNight: 4_500_000, featured: true });
    await expect(
      api.rooms.toggleBookable(created.id, false),
    ).resolves.toMatchObject({
      isBookable: false,
    });
    expect(
      (await api.rooms.search({})).data.some((room) => room.id === created.id),
    ).toBe(false);
  });

  it("lets a guest review a finished stay once, edit and delete it, with a public summary", async () => {
    await loginAsGuest();

    const stay = (await api.bookings.mine()).data.find(
      (booking) => booking.id === "booking-stayed-skyline",
    );
    expect(await api.bookings.getById(stay.id)).toMatchObject({
      canReview: true,
      reviewId: null,
    });
    const before = await api.reviews.listForRoom(stay.roomId);

    await expect(
      api.reviews.create(stay.id, { rating: 0 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const review = await api.reviews.create(stay.id, {
      rating: 5,
      title: "Rất đáng nhớ",
      comment: "Sẽ quay lại",
      displayName: "An",
    });
    expect(review).toMatchObject({
      bookingId: stay.id,
      rating: 5,
      reviewerName: "An",
      status: "visible",
    });
    expect(review).not.toHaveProperty("userId");
    expect(await api.bookings.getById(stay.id)).toMatchObject({
      canReview: false,
      reviewId: review.id,
    });
    await expect(
      api.reviews.create(stay.id, { rating: 4 }),
    ).rejects.toMatchObject({
      status: 409,
      code: "REVIEW_ALREADY_EXISTS",
    });

    const after = await api.reviews.listForRoom(stay.roomId);
    expect(after.summary.reviewCount).toBe(before.summary.reviewCount + 1);
    expect(after.data[0].id).toBe(review.id);
    expect(
      (await api.reviews.listForRoom(stay.roomId, { rating: 5 })).data.every(
        (item) => item.rating === 5,
      ),
    ).toBe(true);

    await expect(
      api.reviews.update(review.id, { rating: 3, comment: "Cập nhật" }),
    ).resolves.toMatchObject({
      rating: 3,
      comment: "Cập nhật",
    });
    expect((await api.reviews.mine()).data).toContainEqual(
      expect.objectContaining({ id: review.id }),
    );

    await api.reviews.remove(review.id);
    await expect(api.reviews.getForBooking(stay.id)).rejects.toMatchObject({
      code: "REVIEW_NOT_FOUND",
    });
  });

  it("rejects reviews for upcoming stays and lets admins hide a review from the public list", async () => {
    await loginAsGuest();
    await expect(
      api.reviews.create("booking-welcome", { rating: 5 }),
    ).rejects.toMatchObject({
      status: 409,
      code: "STAY_NOT_COMPLETED",
    });
    const own = (await api.reviews.mine()).data[0];
    await expect(api.reviews.adminList()).rejects.toMatchObject({
      status: 403,
    });

    await api.identity.login(ADMIN_CREDENTIALS);
    const hidden = await api.reviews.adminSetStatus(own.id, "hidden");
    expect(hidden).toMatchObject({
      status: "hidden",
      bookingCode: expect.any(String),
    });
    expect(
      (await api.reviews.listForRoom(own.roomId)).data.some(
        (item) => item.id === own.id,
      ),
    ).toBe(false);
    expect(
      (await api.reviews.adminList({ status: "hidden" })).data,
    ).toContainEqual(expect.objectContaining({ id: own.id }));
  });
});
