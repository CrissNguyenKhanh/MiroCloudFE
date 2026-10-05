import { Link } from 'react-router-dom'

export default function Brand({ light = false }) {
  return (
    <Link className={`brand${light ? ' brand--light' : ''}`} to="/" aria-label="CloudStay - Trang chủ">
      <span className="brand__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand__name">CloudStay</span>
    </Link>
  )
}
