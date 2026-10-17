import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, CreditCard, RefreshCcw, ShieldCheck } from "lucide-react";
import { api } from "../../api";
import { getErrorMessage } from "../../api/errors";
import { createIdempotencyKey } from "../../utils/booking";
import { formatCurrency } from "../../utils/date";
import PaymentStatusBadge from "./PaymentStatusBadge";

function isUncertain(error) {
  return error?.code === "TIMEOUT" || error?.code === "NETWORK_ERROR";
}

export default function PaymentPanel({ booking, onPaymentChange }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const intentKeyRef = useRef(null);
  const processingRef = useRef(false);
  const requestRef = useRef(0);

  const applyPayment = useCallback((nextPayment) => {
    setPayment(nextPayment);
    const paymentStatus = nextPayment?.status ?? "unpaid";
    if (paymentStatus === "failed") intentKeyRef.current = null;
    if (nextPayment) setUncertain(false);
    onPaymentChange?.({
      paymentStatus,
      canCancel: paymentStatus === "succeeded" ? false : booking.canCancel,
    });
  }, [booking.canCancel, onPaymentChange]);

  const reconcile = useCallback(async ({ initial = false } = {}) => {
    const requestId = ++requestRef.current;
    if (initial) setLoading(true);
    setError("");
    try {
      const latest = await api.payments.getForBooking(booking.id);
      if (requestId !== requestRef.current) return;
      applyPayment(latest);
      if (!latest && uncertain) {
        setError(
          "Máy chủ chưa ghi nhận kết quả. Bạn có thể kiểm tra lại hoặc gửi lại cùng yêu cầu an toàn.",
        );
      }
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      setError(getErrorMessage(loadError));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [applyPayment, booking.id, uncertain]);

  useEffect(() => {
    intentKeyRef.current = null;
    setPayment(null);
    setUncertain(false);
    reconcile({ initial: true });
    return () => { requestRef.current += 1; };
  }, [booking.id]);

  const pay = async () => {
    if (processingRef.current || booking.status === "cancelled") return;
    processingRef.current = true;
    setProcessing(true);
    setError("");
    intentKeyRef.current ??= createIdempotencyKey();
    try {
      const result = await api.payments.create(booking.id, {
        idempotencyKey: intentKeyRef.current,
      });
      applyPayment(result);
    } catch (paymentError) {
      if (isUncertain(paymentError)) {
        setUncertain(true);
        setError(
          "Kết nối bị gián đoạn nên chưa thể xác nhận kết quả. Không tự động gửi lại; hãy kiểm tra trạng thái trước.",
        );
      } else {
        intentKeyRef.current = null;
        setError(getErrorMessage(paymentError));
      }
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const status = uncertain ? "uncertain" : payment?.status ?? booking.paymentStatus ?? "unpaid";
  const paid = status === "succeeded";
  const pending = status === "pending";
  const cancelled = booking.status === "cancelled";
  const amount = payment?.amount ?? booking.totalPrice;

  return (
    <section className="payment-panel" aria-labelledby="payment-panel-title">
      <div className="payment-panel__heading">
        <span className="payment-panel__icon"><CreditCard /></span>
        <div>
          <span className="eyebrow">Thanh toán mô phỏng</span>
          <h2 id="payment-panel-title">Xác nhận thanh toán booking</h2>
        </div>
        <PaymentStatusBadge status={status} />
      </div>
      <div className="payment-panel__summary">
        <span><small>Số tiền từ backend</small><strong>{formatCurrency(amount)}</strong></span>
        <span><small>Nhà cung cấp</small><strong>{payment?.provider ?? "MOCK"}</strong></span>
        <span><small>Loại giao dịch</small><strong>Mô phỏng, không thu tiền thật</strong></span>
      </div>

      {loading && <p className="inline-notice">Đang đối chiếu trạng thái thanh toán…</p>}
      {error && <p className="inline-notice inline-notice--warning" role="alert"><CircleAlert /> {error}</p>}
      {paid && <p className="inline-notice inline-notice--success"><ShieldCheck /> Backend đã xác nhận thanh toán MOCK thành công. Booking này không thể hủy khi chưa có quy trình hoàn tiền.</p>}
      {payment?.status === "failed" && <p className="inline-notice inline-notice--warning">Lần mô phỏng trước thất bại{payment.failureReason ? `: ${payment.failureReason}` : "."} Bạn có thể thử lại bằng một yêu cầu mới.</p>}
      {cancelled && <p className="inline-notice inline-notice--warning">Booking đã hủy nên không thể thanh toán.</p>}

      <div className="payment-panel__actions">
        {!paid && !pending && !cancelled && (
          <button className="button button--copper" type="button" onClick={pay} disabled={processing || loading}>
            <CreditCard size={18} />
            {processing ? "Đang gửi yêu cầu…" : uncertain ? "Gửi lại cùng yêu cầu" : "Thanh toán mô phỏng"}
          </button>
        )}
        {!cancelled && (
          <button className="button button--outline" type="button" onClick={() => reconcile()} disabled={processing || loading}>
            <RefreshCcw size={17} /> Kiểm tra trạng thái
          </button>
        )}
      </div>
    </section>
  );
}
