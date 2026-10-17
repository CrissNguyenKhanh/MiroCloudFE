import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PaymentPanel from "./PaymentPanel";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getForBooking: vi.fn(),
}));

vi.mock("../../api", () => ({
  api: { payments: mocks },
}));

const booking = {
  id: "booking-1",
  status: "confirmed",
  paymentStatus: "unpaid",
  totalPrice: 2_000_000,
  canCancel: true,
};

describe("PaymentPanel", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.getForBooking.mockReset().mockResolvedValue(null);
  });

  it("submits MOCK payment once and uses the backend amount/status", async () => {
    let resolvePayment;
    mocks.create.mockReturnValue(new Promise((resolve) => { resolvePayment = resolve; }));
    const onPaymentChange = vi.fn();
    render(<PaymentPanel booking={booking} onPaymentChange={onPaymentChange} />);

    const button = await screen.findByRole("button", { name: "Thanh toán mô phỏng" });
    await userEvent.dblClick(button);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const key = mocks.create.mock.calls[0][1].idempotencyKey;
    expect(key).toEqual(expect.any(String));

    resolvePayment({
      id: "payment-1",
      provider: "MOCK",
      amount: 2_000_000,
      status: "succeeded",
    });
    expect(await screen.findByText("Đã thanh toán")).toBeVisible();
    expect(onPaymentChange).toHaveBeenLastCalledWith({
      paymentStatus: "succeeded",
      canCancel: false,
    });
  });

  it("does not auto-retry a timeout and reuses the same key after reconciliation", async () => {
    mocks.create
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "TIMEOUT" }))
      .mockResolvedValueOnce({ id: "payment-1", amount: 2_000_000, provider: "MOCK", status: "succeeded" });
    render(<PaymentPanel booking={booking} />);

    await userEvent.click(await screen.findByRole("button", { name: "Thanh toán mô phỏng" }));
    expect(await screen.findByText("Chưa xác nhận")).toBeVisible();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const key = mocks.create.mock.calls[0][1].idempotencyKey;

    await userEvent.click(screen.getByRole("button", { name: "Kiểm tra trạng thái" }));
    await waitFor(() => expect(mocks.getForBooking).toHaveBeenCalledTimes(2));
    expect(mocks.create).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Gửi lại cùng yêu cầu" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][1].idempotencyKey).toBe(key);
  });

  it("never offers payment for a cancelled booking", async () => {
    render(<PaymentPanel booking={{ ...booking, status: "cancelled" }} />);
    expect(await screen.findByText("Booking đã hủy nên không thể thanh toán.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Thanh toán mô phỏng" })).not.toBeInTheDocument();
  });
});
