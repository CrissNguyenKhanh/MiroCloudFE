import { useCallback, useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { getErrorMessage } from '../api/errors'
import { ROOM_TYPES } from '../data/mockData'
import RoomCard from '../components/rooms/RoomCard'
import SearchForm from '../components/rooms/SearchForm'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { formatCurrency, getDefaultStayRange } from '../utils/date'

const PRICE_OPTIONS = [
  { value: '', label: 'Mọi mức giá' },
  { value: '1500000', label: `Đến ${formatCurrency(1500000)}` },
  { value: '2200000', label: `Đến ${formatCurrency(2200000)}` },
  { value: '3000000', label: `Đến ${formatCurrency(3000000)}` },
  { value: '4000000', label: `Đến ${formatCurrency(4000000)}` },
]

export default function SearchPage() {
  const defaults = getDefaultStayRange()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchValues = useMemo(() => ({
    checkIn: searchParams.get('checkIn') || defaults.checkIn,
    checkOut: searchParams.get('checkOut') || defaults.checkOut,
    guests: Number(searchParams.get('guests')) || 2,
    type: searchParams.get('type') || '',
    maxPrice: searchParams.get('maxPrice') || '',
  }), [searchParams.toString()])

  const [rooms, setRooms] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [mobileFilters, setMobileFilters] = useState(false)

  const loadRooms = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const result = await api.rooms.search(searchValues)
      setRooms(result)
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [searchValues.checkIn, searchValues.checkOut, searchValues.guests, searchValues.type, searchValues.maxPrice])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const updateStay = (values) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(values).forEach(([key, value]) => next.set(key, String(value)))
    setSearchParams(next)
  }

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('type')
    next.delete('maxPrice')
    setSearchParams(next)
  }

  const detailQuery = `?${new URLSearchParams({
    checkIn: searchValues.checkIn,
    checkOut: searchValues.checkOut,
    guests: String(searchValues.guests),
  })}`

  return (
    <div className="page page--soft">
      <section className="search-page__top">
        <div className="container">
          <span className="eyebrow">Chọn khoảng nghỉ của bạn</span>
          <h1>Phòng trống tại CloudStay</h1>
          <SearchForm compact initialValues={searchValues} onSearch={updateStay} />
        </div>
      </section>

      <section className="section section--search-results">
        <div className="container">
          <div className="results-toolbar">
            <div>
              <span className="eyebrow">Kết quả phù hợp</span>
              <h2>{status === 'success' ? `${rooms.length} lựa chọn dành cho bạn` : 'Đang tìm phòng phù hợp'}</h2>
            </div>
            <button className="button button--outline filters-toggle" type="button" onClick={() => setMobileFilters(true)}>
              <SlidersHorizontal size={17} /> Bộ lọc
            </button>
          </div>

          <div className="results-layout">
            <aside className={`filters-panel${mobileFilters ? ' filters-panel--open' : ''}`} aria-label="Bộ lọc phòng">
              <div className="filters-panel__header">
                <h2>Bộ lọc</h2>
                <button className="icon-button" type="button" onClick={() => setMobileFilters(false)} aria-label="Đóng bộ lọc"><X /></button>
              </div>
              <div className="filter-group">
                <label htmlFor="room-type">Hạng phòng</label>
                <select id="room-type" value={searchValues.type} onChange={(event) => updateFilter('type', event.target.value)}>
                  <option value="">Tất cả hạng phòng</option>
                  {ROOM_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="max-price">Giá mỗi đêm</label>
                <select id="max-price" value={searchValues.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)}>
                  {PRICE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </div>
              <button className="text-button" type="button" onClick={clearFilters}>Xóa bộ lọc</button>
              <div className="filters-panel__note">
                <strong>Giá minh bạch</strong>
                <p>Giá hiển thị là giá dự kiến mỗi đêm. Backend sẽ xác nhận giá cuối cùng khi đặt.</p>
              </div>
            </aside>

            <div className="results-content">
              {status === 'loading' && <LoadingState label="Đang kiểm tra phòng trống…" />}
              {status === 'error' && <ErrorState message={error} onRetry={loadRooms} />}
              {status === 'success' && rooms.length === 0 && (
                <EmptyState
                  title="Chưa tìm thấy phòng phù hợp"
                  message="Hãy thử thay đổi ngày lưu trú, số khách hoặc bỏ bớt bộ lọc."
                  action={<button type="button" className="button button--navy" onClick={clearFilters}>Xóa bộ lọc</button>}
                />
              )}
              {status === 'success' && rooms.length > 0 && (
                <div className="room-grid room-grid--results">
                  {rooms.map((room) => <RoomCard room={room} key={room.id} search={detailQuery} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
