import { CalendarDays, Search, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDefaultStayRange, todayISO, validateStay } from '../../utils/date'
import { FieldError } from '../common/States'

function readGuests(value) {
  if (value === undefined || value === null || value === '') return 2
  return Number(value)
}

export default function SearchForm({ initialValues, compact = false, onSearch }) {
  const navigate = useNavigate()
  const defaults = getDefaultStayRange()
  const [values, setValues] = useState({
    checkIn: initialValues?.checkIn || defaults.checkIn,
    checkOut: initialValues?.checkOut || defaults.checkOut,
    guests: readGuests(initialValues?.guests),
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!initialValues) return
    setValues({
      checkIn: initialValues.checkIn || defaults.checkIn,
      checkOut: initialValues.checkOut || defaults.checkOut,
      guests: readGuests(initialValues.guests),
    })
  }, [initialValues?.checkIn, initialValues?.checkOut, initialValues?.guests])

  const update = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: name === 'guests' ? Number(value) : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const submit = (event) => {
    event.preventDefault()
    const nextErrors = validateStay(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (onSearch) return onSearch(values)
    const query = new URLSearchParams({
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests: String(values.guests),
    })
    navigate(`/rooms?${query}`)
  }

  return (
    <form className={`search-form${compact ? ' search-form--compact' : ''}`} onSubmit={submit} noValidate>
      <div className="search-form__field">
        <label htmlFor={`check-in-${compact ? 'compact' : 'hero'}`}>
          <CalendarDays size={17} /> Nhận phòng
        </label>
        <input
          id={`check-in-${compact ? 'compact' : 'hero'}`}
          type="date"
          name="checkIn"
          min={todayISO()}
          value={values.checkIn}
          onChange={update}
          aria-invalid={Boolean(errors.checkIn)}
          aria-describedby={errors.checkIn ? 'check-in-error' : undefined}
        />
        <FieldError id="check-in-error">{errors.checkIn}</FieldError>
      </div>
      <div className="search-form__divider" aria-hidden="true" />
      <div className="search-form__field">
        <label htmlFor={`check-out-${compact ? 'compact' : 'hero'}`}>
          <CalendarDays size={17} /> Trả phòng
        </label>
        <input
          id={`check-out-${compact ? 'compact' : 'hero'}`}
          type="date"
          name="checkOut"
          min={values.checkIn || todayISO()}
          value={values.checkOut}
          onChange={update}
          aria-invalid={Boolean(errors.checkOut)}
          aria-describedby={errors.checkOut ? 'check-out-error' : undefined}
        />
        <FieldError id="check-out-error">{errors.checkOut}</FieldError>
      </div>
      <div className="search-form__divider" aria-hidden="true" />
      <div className="search-form__field search-form__guests">
        <label htmlFor={`guests-${compact ? 'compact' : 'hero'}`}>
          <UsersRound size={17} /> Số khách
        </label>
        <select
          id={`guests-${compact ? 'compact' : 'hero'}`}
          name="guests"
          value={values.guests}
          onChange={update}
          aria-invalid={Boolean(errors.guests)}
          aria-describedby={errors.guests ? 'guests-error' : undefined}
        >
          {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} khách</option>)}
        </select>
        <FieldError id="guests-error">{errors.guests}</FieldError>
      </div>
      <button className="button button--copper search-form__submit" type="submit">
        <Search size={19} /> <span>Tìm phòng</span>
      </button>
    </form>
  )
}
