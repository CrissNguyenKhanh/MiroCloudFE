import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Plus, Search, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import { ROOM_TYPES } from '../../data/mockData'
import { ErrorState, FieldError, LoadingState } from '../../components/common/States'
import { useToast } from '../../contexts/ToastContext'
import { formatCurrency } from '../../utils/date'

const emptyForm = {
  name: '', roomNumber: '', type: 'deluxe', pricePerNight: 1500000, capacity: 2,
  size: 32, floor: 1, bed: '1 giường King', view: 'Thành phố', description: '', amenitiesText: 'Wi-Fi tốc độ cao, Smart TV',
}

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const loadRooms = useCallback(async () => {
    setStatus('loading')
    try {
      setRooms(await api.rooms.adminList())
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [])

  useEffect(() => { loadRooms() }, [loadRooms])

  const filtered = useMemo(() => rooms.filter((room) => [room.name, room.roomNumber, room.type].join(' ').toLowerCase().includes(query.toLowerCase())), [query, rooms])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormErrors({})
    setFormOpen(true)
  }

  const openEdit = (room) => {
    setEditingId(room.id)
    setForm({
      name: room.name, roomNumber: room.roomNumber, type: room.type, pricePerNight: room.pricePerNight,
      capacity: room.capacity, size: room.size, floor: room.floor, bed: room.bed, view: room.view,
      description: room.description, amenitiesText: room.amenities.join(', '),
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const update = (event) => {
    const { name, value, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'number' ? Number(value) : value }))
    setFormErrors((current) => ({ ...current, [name]: undefined }))
  }

  const save = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Vui lòng nhập tên phòng.'
    if (!form.roomNumber.trim()) nextErrors.roomNumber = 'Vui lòng nhập số phòng.'
    if (form.pricePerNight <= 0) nextErrors.pricePerNight = 'Giá phải lớn hơn 0.'
    if (!Number.isInteger(form.capacity) || form.capacity < 1) nextErrors.capacity = 'Sức chứa không hợp lệ.'
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    const payload = {
      ...form,
      amenities: form.amenitiesText.split(',').map((item) => item.trim()).filter(Boolean),
    }
    delete payload.amenitiesText
    try {
      if (editingId) {
        const updated = await api.rooms.update(editingId, payload)
        setRooms((current) => current.map((room) => room.id === editingId ? updated : room))
        showToast('Đã cập nhật thông tin phòng.')
      } else {
        const created = await api.rooms.create(payload)
        setRooms((current) => [...current, created])
        showToast('Đã thêm phòng mới.')
      }
      setFormOpen(false)
    } catch (saveError) {
      if (saveError.details) setFormErrors(saveError.details)
      showToast(getErrorMessage(saveError), 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (room) => {
    try {
      const updated = await api.rooms.toggleBookable(room.id, !room.isBookable)
      setRooms((current) => current.map((item) => item.id === room.id ? updated : item))
      showToast(updated.isBookable ? 'Phòng đã nhận đặt trở lại.' : 'Phòng đã ngừng nhận đặt.')
    } catch (toggleError) {
      showToast(getErrorMessage(toggleError), 'error')
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--actions">
        <div><span className="eyebrow">Room inventory</span><h1>Quản lý phòng</h1><p>Thêm, chỉnh sửa và kiểm soát khả năng nhận đặt.</p></div>
        <button className="button button--copper" type="button" onClick={openCreate}><Plus /> Thêm phòng</button>
      </header>

      <div className="admin-toolbar">
        <label className="search-input"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc số phòng…" aria-label="Tìm phòng" /></label>
        <span>{filtered.length} / {rooms.length} phòng</span>
      </div>

      {status === 'loading' && <LoadingState label="Đang tải danh sách phòng…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadRooms} />}
      {status === 'success' && (
        <div className="admin-panel admin-panel--flush">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Phòng</th><th>Hạng</th><th>Sức chứa</th><th>Giá / đêm</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {filtered.map((room) => (
                  <tr key={room.id}>
                    <td><div className="room-table-name"><span style={{ background: room.palette?.[0] }} /> <div><strong>{room.name}</strong><small>Phòng {room.roomNumber} · Tầng {room.floor}</small></div></div></td>
                    <td className="capitalize">{room.type}</td>
                    <td>{room.capacity} khách</td>
                    <td>{formatCurrency(room.pricePerNight)}</td>
                    <td><span className={`availability-pill${room.isBookable ? ' availability-pill--on' : ''}`}>{room.isBookable ? 'Đang nhận đặt' : 'Tạm ngừng'}</span></td>
                    <td><div className="table-actions"><button type="button" onClick={() => openEdit(room)} aria-label={`Sửa ${room.name}`}><Edit3 /></button><button type="button" onClick={() => toggle(room)} aria-label={room.isBookable ? `Ngừng nhận đặt ${room.name}` : `Nhận đặt lại ${room.name}`}>{room.isBookable ? <ToggleRight /> : <ToggleLeft />}</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setFormOpen(false)}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="room-form-title">
            <div className="admin-modal__header"><div><span className="eyebrow">{editingId ? 'Chỉnh sửa' : 'Phòng mới'}</span><h2 id="room-form-title">{editingId ? 'Cập nhật phòng' : 'Thêm phòng'}</h2></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Đóng"><X /></button></div>
            <form className="stack-form" onSubmit={save} noValidate>
              <div className="form-grid form-grid--two">
                <label>Tên phòng<input name="name" value={form.name} onChange={update} /><FieldError>{formErrors.name}</FieldError></label>
                <label>Số phòng<input name="roomNumber" value={form.roomNumber} onChange={update} /><FieldError>{formErrors.roomNumber}</FieldError></label>
                <label>Hạng phòng<select name="type" value={form.type} onChange={update}>{ROOM_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label>
                <label>Giá mỗi đêm<input type="number" min="1" step="50000" name="pricePerNight" value={form.pricePerNight} onChange={update} /><FieldError>{formErrors.pricePerNight}</FieldError></label>
                <label>Sức chứa<input type="number" min="1" max="12" name="capacity" value={form.capacity} onChange={update} /><FieldError>{formErrors.capacity}</FieldError></label>
                <label>Diện tích (m²)<input type="number" min="1" name="size" value={form.size} onChange={update} /></label>
                <label>Tầng<input type="number" min="1" name="floor" value={form.floor} onChange={update} /></label>
                <label>Loại giường<input name="bed" value={form.bed} onChange={update} /></label>
              </div>
              <label>Hướng nhìn<input name="view" value={form.view} onChange={update} /></label>
              <label>Tiện nghi <span>(phân tách bằng dấu phẩy)</span><input name="amenitiesText" value={form.amenitiesText} onChange={update} /></label>
              <label>Mô tả<textarea rows="3" name="description" value={form.description} onChange={update} /></label>
              <div className="admin-modal__actions"><button type="button" className="button button--ghost" onClick={() => setFormOpen(false)}>Hủy</button><button className="button button--navy" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu phòng'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
