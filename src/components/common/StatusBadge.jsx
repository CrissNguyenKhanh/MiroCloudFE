import { bookingStatusLabel } from '../../utils/booking'

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-badge--${status}`}>{bookingStatusLabel(status)}</span>
}
