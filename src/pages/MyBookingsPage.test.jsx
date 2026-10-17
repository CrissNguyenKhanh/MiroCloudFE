import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MyBookingsPage from "./MyBookingsPage";

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  cancelMine: vi.fn(),
  reviewsMine: vi.fn(),
  getReviewForBooking: vi.fn(),
  createReview: vi.fn(),
  updateReview: vi.fn(),
  removeReview: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../api", () => ({
  api: {
    bookings: {
      mine: mocks.mine,
      cancelMine: mocks.cancelMine,
    },
    reviews: {
      mine: mocks.reviewsMine,
      getForBooking: mocks.getReviewForBooking,
      create: mocks.createReview,
      update: mocks.updateReview,
      remove: mocks.removeReview,
    },
  },
}));

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

function booking(overrides = {}) {
  return {
    id: "booking-1",
    code: "BK-1001",
    roomId: "room-1",
    roomName: "Deluxe Skyline",
    roomNumber: "101",
    checkInDate: "2028-06-10",
    checkOutDate: "2028-06-12",
    nights: 2,
    guests: 2,
    totalPrice: 2_000_000,
    status: "confirmed",
    canCancel: true,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyBookingsPage />
    </MemoryRouter>,
  );
}

describe("MyBookingsPage cancellation", () => {
  beforeEach(() => {
    mocks.mine.mockReset();
    mocks.cancelMine.mockReset();
    mocks.showToast.mockReset();
  });

  it("explains the policy and never offers cancellation after the deadline", async () => {
    mocks.mine.mockResolvedValue({
      data: [booking({ canCancel: false })],
      meta: { total: 1 },
    });

    renderPage();

    expect(await screen.findByText("Đã quá hạn hủy đặt phòng.")).toBeVisible();
    expect(
      screen.getByText(/Chỉ được hủy trước 14:00 ngày trước ngày nhận phòng/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Hủy đơn/i }),
    ).not.toBeInTheDocument();
    expect(mocks.cancelMine).not.toHaveBeenCalled();
  });

  it("cancels an eligible booking once, accepts an optional reason, and refreshes the list", async () => {
    const confirmed = booking();
    const cancelled = booking({
      status: "cancelled",
      canCancel: false,
      cancellationReason: "Thay đổi kế hoạch",
    });
    mocks.mine
      .mockResolvedValueOnce({ data: [confirmed], meta: { total: 1 } })
      .mockResolvedValueOnce({ data: [cancelled], meta: { total: 1 } });
    mocks.cancelMine.mockResolvedValue(cancelled);
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /Hủy đơn/i }),
    );
    await userEvent.type(
      screen.getByLabelText(/Lý do hủy/i),
      "  Thay đổi kế hoạch  ",
    );
    await userEvent.dblClick(
      screen.getByRole("button", { name: "Xác nhận hủy" }),
    );

    await waitFor(() => expect(mocks.cancelMine).toHaveBeenCalledTimes(1));
    expect(mocks.cancelMine).toHaveBeenCalledWith("booking-1", {
      reason: "Thay đổi kế hoạch",
    });
    expect(mocks.mine).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText(/Lý do hủy: Thay đổi kế hoạch/),
    ).toBeVisible();
  });

  it("shows the backend cancellation-window error and refreshes eligibility", async () => {
    mocks.mine.mockResolvedValue({ data: [booking()], meta: { total: 1 } });
    mocks.cancelMine.mockRejectedValue(
      Object.assign(new Error("expired"), {
        code: "CANCELLATION_WINDOW_PASSED",
        status: 409,
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Hủy đơn/i }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));

    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        "Đã qua hạn hủy: muộn hơn 14:00 ngày trước ngày nhận phòng.",
        "error",
      ),
    );
    expect(mocks.mine).toHaveBeenCalledTimes(2);
  });
});

function finishedBooking(overrides = {}) {
  return booking({
    id: "booking-done",
    code: "BK-2002",
    checkInDate: "2020-01-10",
    checkOutDate: "2020-01-12",
    canCancel: false,
    ...overrides,
  });
}

function review(overrides = {}) {
  return {
    id: "review-1",
    bookingId: "booking-done",
    roomId: "room-1",
    rating: 4,
    title: "Rất ổn",
    comment: "Phòng sạch sẽ",
    reviewerName: "An",
    status: "visible",
    createdAt: "2020-01-13T03:00:00.000Z",
    updatedAt: "2020-01-13T03:00:00.000Z",
    ...overrides,
  };
}

describe("MyBookingsPage reviews", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.reviewsMine.mockResolvedValue({ data: [], meta: { total: 0 } });
    mocks.getReviewForBooking.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "REVIEW_NOT_FOUND", status: 404 }),
    );
  });

  it("does not look up reviews or offer review for upcoming stays", async () => {
    mocks.mine.mockResolvedValue({ data: [booking()], meta: { total: 1 } });

    renderPage();

    expect(await screen.findByText("BK-1001")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Viết đánh giá" }),
    ).not.toBeInTheDocument();
    expect(mocks.getReviewForBooking).not.toHaveBeenCalled();
  });

  it("validates, then sends a new review for a finished stay and shows it on the card", async () => {
    mocks.mine.mockResolvedValue({
      data: [finishedBooking()],
      meta: { total: 1 },
    });
    mocks.createReview.mockResolvedValue(
      review({ rating: 5, title: "", comment: "Rất tuyệt" }),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Viết đánh giá" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));
    expect(screen.getByText("Vui lòng chọn số sao từ 1 đến 5.")).toBeVisible();
    expect(screen.getByText("Vui lòng nhập tên hiển thị.")).toBeVisible();
    expect(mocks.createReview).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText("5 sao"));
    await userEvent.type(screen.getByLabelText(/Nội dung/), "  Rất tuyệt ");
    await userEvent.type(screen.getByLabelText(/Tên hiển thị/), "An");
    await userEvent.dblClick(
      screen.getByRole("button", { name: "Gửi đánh giá" }),
    );

    await waitFor(() => expect(mocks.createReview).toHaveBeenCalledTimes(1));
    expect(mocks.createReview).toHaveBeenCalledWith("booking-done", {
      rating: 5,
      title: "",
      comment: "Rất tuyệt",
      displayName: "An",
    });
    expect(
      await screen.findByRole("button", { name: "Sửa đánh giá" }),
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith(
      "Cảm ơn bạn đã chia sẻ đánh giá!",
    );
  });

  it("shows an existing (hidden) review, edits it and deletes it after confirmation", async () => {
    mocks.mine.mockResolvedValue({
      data: [finishedBooking()],
      meta: { total: 1 },
    });
    mocks.getReviewForBooking.mockResolvedValue(review({ status: "hidden" }));
    mocks.updateReview.mockResolvedValue(
      review({ rating: 5, title: "Tuyệt vời" }),
    );
    mocks.removeReview.mockResolvedValue(undefined);
    renderPage();

    expect(await screen.findByText("Rất ổn")).toBeVisible();
    expect(screen.getByText("Đang bị ẩn")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Viết đánh giá" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sửa đánh giá" }));
    expect(screen.getByLabelText(/Tên hiển thị/)).toHaveValue("An");
    await userEvent.click(screen.getByLabelText("5 sao"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(mocks.updateReview).toHaveBeenCalledWith("review-1", {
        rating: 5,
        title: "Rất ổn",
        comment: "Phòng sạch sẽ",
        displayName: "An",
      }),
    );
    expect(await screen.findByText("Tuyệt vời")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
    await waitFor(() =>
      expect(mocks.removeReview).toHaveBeenCalledWith("review-1"),
    );
    expect(
      await screen.findByRole("button", { name: "Viết đánh giá" }),
    ).toBeVisible();
  });

  it("refreshes the list when the backend says the booking was already reviewed", async () => {
    mocks.mine.mockResolvedValue({
      data: [finishedBooking()],
      meta: { total: 1 },
    });
    mocks.createReview.mockRejectedValue(
      Object.assign(new Error("Lịch đặt này đã được đánh giá"), {
        status: 409,
        code: "REVIEW_ALREADY_EXISTS",
      }),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Viết đánh giá" }),
    );
    await userEvent.click(screen.getByLabelText("4 sao"));
    await userEvent.type(screen.getByLabelText(/Tên hiển thị/), "An");
    await userEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        "Lịch đặt này đã được đánh giá",
        "error",
      ),
    );
    await waitFor(() => expect(mocks.mine).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the bookings visible without review actions when the review lookup fails", async () => {
    mocks.mine.mockResolvedValue({
      data: [finishedBooking()],
      meta: { total: 1 },
    });
    mocks.getReviewForBooking.mockRejectedValue(new Error("down"));

    renderPage();

    expect(await screen.findByText("BK-2002")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Viết đánh giá" }),
    ).not.toBeInTheDocument();
  });
});
