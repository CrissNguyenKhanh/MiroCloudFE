import { createHttpClient } from "../client";
import { apiConfig } from "../config";
import { createBookingsHttpApi } from "./bookings";
import { createIdentityHttpApi } from "./identity";
import { createMediaHttpApi } from "./media";
import { createNotificationsHttpApi } from "./notifications";
import { createPaymentsHttpApi } from "./payments";
import { createReviewsHttpApi } from "./reviews";
import { createRoomsHttpApi } from "./rooms";

export function createHttpApi(config = apiConfig) {
  const timeoutMs = config.timeoutMs ?? apiConfig.timeoutMs;
  const identityRequest = createHttpClient({
    baseUrl: config.identityBaseUrl ?? "",
    timeoutMs,
  });
  const bookingRequest = createHttpClient({
    baseUrl: config.bookingBaseUrl ?? "",
    timeoutMs,
  });
  const notificationRequest = createHttpClient({
    baseUrl: config.notificationBaseUrl ?? "",
    timeoutMs,
  });

  return {
    identity: createIdentityHttpApi(identityRequest),
    rooms: createRoomsHttpApi(bookingRequest),
    bookings: createBookingsHttpApi(bookingRequest),
    payments: createPaymentsHttpApi(bookingRequest),
    media: createMediaHttpApi(bookingRequest),
    reviews: createReviewsHttpApi(bookingRequest),
    notifications: createNotificationsHttpApi(notificationRequest),
  };
}

export const httpApi = createHttpApi();
