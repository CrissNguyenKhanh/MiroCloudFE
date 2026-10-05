import { ArrowUpRight, BedDouble, Maximize2, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/date'
import RoomVisual from './RoomVisual'

export default function RoomCard({ room, search = '' }) {
  return (
    <article className="room-card">
      <Link className="room-card__image-link" to={`/rooms/${room.id}${search}`} aria-label={`Xem ${room.name}`}>
        <RoomVisual room={room} />
        {room.featured && <span className="room-card__tag">Được yêu thích</span>}
      </Link>
      <div className="room-card__body">
        <div className="room-card__heading">
          <div>
            <span className="eyebrow">Phòng {room.roomNumber}</span>
            <h3><Link to={`/rooms/${room.id}${search}`}>{room.name}</Link></h3>
          </div>
          <div className="room-card__price">
            <strong>{formatCurrency(room.pricePerNight)}</strong>
            <span>/ đêm</span>
          </div>
        </div>
        <div className="room-card__meta">
          <span><UsersRound size={16} /> {room.capacity} khách</span>
          <span><Maximize2 size={16} /> {room.size} m²</span>
          <span><BedDouble size={16} /> {room.bed}</span>
        </div>
        <div className="room-card__footer">
          <span>{room.amenities.slice(0, 2).join(' · ')}</span>
          <Link className="text-link" to={`/rooms/${room.id}${search}`}>
            Xem phòng <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  )
}
