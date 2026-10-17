const labels = {
  unpaid: "Chưa thanh toán",
  pending: "Đang xử lý",
  succeeded: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  uncertain: "Chưa xác nhận",
};

export default function PaymentStatusBadge({ status = "unpaid" }) {
  const normalized = String(status || "unpaid").toLowerCase();
  return (
    <span className={`payment-status payment-status--${normalized}`}>
      {labels[normalized] ?? normalized}
    </span>
  );
}
