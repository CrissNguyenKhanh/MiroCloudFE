import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { getErrorMessage } from '../api/errors'
import { ROOM_TYPES } from '../data/mockData'
import RoomCard from '../components/rooms/RoomCard'
import SearchForm from '../components/rooms/SearchForm'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { formatCurrency, getDefaultStayRange } from '../utils/date'

const PAGE_SIZE = 9

const PRICE_OPTIONS = [
  { value: '', label: 'Mọi mức giá' },
  { value: '1500000', label: `Đến ${formatCurrency(1500000)}` },
  { value: '2200000', label: `Đến ${formatCurrency(2200000)}` },
  { value: '3000000', label: `Đến ${formatCurrency(3000000)}` },
  { value: '4000000', label: `Đến ${formatCurrency(4000000)}` },
]

function readNumber(value, fallback) {
  if (value === null || value === '') return fallback
  return Number(value)
}

function readPage(value) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export default function SearchPage() {
  const defaults = getDefaultStayRange()
  const [searchParams, setSearchParams] = useSearchParams()
  const paramsKey = searchParams.toString()
  const searchValues = useMemo(() => ({
    checkIn: searchParams.get('checkIn') || defaults.checkIn,
    checkOut: searchParams.get('checkOut') || defaults.checkOut,
    guests: readNumber(searchParams.get('guests'), 2),
    type: searchParams.get('type') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    page: readPage(searchParams.get('page')),
  }), [paramsKey, defaults.checkIn, defaults.checkOut])

  const [rooms, setRooms] = useState([])
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [mobileFilters, setMobileFilters] = useState(false)
  const requestIdRef = useRef(0)

  const loadRooms = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setStatus('loading')
    setError('')
    try {
      const result = await api.rooms.search({ ...searchValues, limit: PAGE_SIZE })
      if (requestId !== requestIdRef.current) return
      setRooms(result.data)
      setMeta(result.meta)
      setStatus('success')
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [
    searchValues.checkIn,
    searchValues.checkOut,
    searchValues.guests,
    searchValues.type,
    searchValues.maxPrice,
    searchValues.page,
  ])

  useEffect(() => {
    loadRooms()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadRooms])

  const updateParams = (updates, { resetPage = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === '' || value === undefined || value === null) next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  const updateStay = (values) => updateParams(values, { resetPage: true })
  const updateFilter = (key, value) => updateParams({ [key]: value }, { resetPage: true })

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('type')
    next.delete('maxPrice')
    next.delete('page')
    setSearchParams(next)
  }

  const detailQuery = `?${new URLSearchParams({
    checkIn: searchValues.checkIn,
    checkOut: searchValues.checkOut,
    guests: String(searchValues.guests),
  })}`
  const total = Number(meta?.total)
  const hasKnownTotal = Number.isFinite(total) && total >= 0
  const resultCount = hasKnownTotal ? total : rooms.length
  const hasPrevious = searchValues.page > 1
  const hasNext = hasKnownTotal
    ? searchValues.page * PAGE_SIZE < total
    : rooms.length === PAGE_SIZE

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
              <h2>{status === 'success' ? `${resultCount} lựa chọn dành cho bạn` : 'Đang tìm phòng phù hợp'}</h2>
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
                  title={hasPrevious ? 'Trang này không còn kết quả' : 'Chưa tìm thấy phòng phù hợp'}
                  message={hasPrevious ? 'Dữ liệu có thể đã thay đổi. Hãy quay lại trang trước.' : 'Hãy thử thay đổi ngày lưu trú, số khách hoặc bỏ bớt bộ lọc.'}
                  action={hasPrevious
                    ? <button type="button" className="button button--navy" onClick={() => updateParams({ page: searchValues.page - 1 })}>Trang trước</button>
                    : <button type="button" className="button button--navy" onClick={clearFilters}>Xóa bộ lọc</button>}
                />
              )}
              {status === 'success' && rooms.length > 0 && (
                <>
                  <div className="room-grid room-grid--results">
                    {rooms.map((room) => <RoomCard room={room} key={room.id} search={detailQuery} />)}
                  </div>
                  {(hasPrevious || hasNext) && (
                    <nav className="pagination" aria-label="Phân trang kết quả phòng">
                      <button className="button button--outline" type="button" disabled={!hasPrevious} onClick={() => updateParams({ page: searchValues.page - 1 })}>
                        <ChevronLeft size={17} /> Trang trước
                      </button>
                      <span>Trang {searchValues.page}</span>
                      <button className="button button--outline" type="button" disabled={!hasNext} onClick={() => updateParams({ page: searchValues.page + 1 })}>
                        Trang sau <ChevronRight size={17} />
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
