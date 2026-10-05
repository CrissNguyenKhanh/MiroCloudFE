import { AlertTriangle, BedDouble, LoaderCircle, RotateCcw } from 'lucide-react'

export function LoadingState({ label = 'Đang chuẩn bị cho bạn…', compact = false }) {
  return (
    <div className={`state-card${compact ? ' state-card--compact' : ''}`} role="status">
      <LoaderCircle className="spin" size={28} aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({ title = 'Chưa có dữ liệu', message, action }) {
  return (
    <div className="state-card">
      <BedDouble size={34} aria-hidden="true" />
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ title = 'Không thể tải dữ liệu', message, onRetry }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <AlertTriangle size={32} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="button button--outline" onClick={onRetry}>
          <RotateCcw size={17} /> Thử lại
        </button>
      )}
    </div>
  )
}

export function FieldError({ id, children }) {
  if (!children) return null
  return <span className="field-error" id={id}>{children}</span>
}
