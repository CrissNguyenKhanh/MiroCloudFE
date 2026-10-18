import { useState } from 'react'
import { X } from 'lucide-react'
import { getErrorMessage } from '../../api/errors'
import useDialogAccessibility from '../../hooks/useDialogAccessibility'
import { FieldError } from '../common/States'
import { REVIEW_LIMITS, validateReview } from '../../utils/review'
import StarRatingInput from './StarRatingInput'

// Create/edit form. `onSubmit(values)` must throw on failure so the error is shown
// inside the dialog; on success the parent closes the dialog.
export default function ReviewFormModal({ roomName, review = null, defaultDisplayName = '', onSubmit, onClose }) {
  const editing = Boolean(review)
  const [values, setValues] = useState({
    rating: review?.rating ?? 0,
    title: review?.title ?? '',
    comment: review?.comment ?? '',
    displayName: review?.reviewerName ?? defaultDisplayName,
  })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useDialogAccessibility({ onClose, closeDisabled: submitting })

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors = validateReview(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit({
        rating: values.rating,
        title: values.title.trim(),
        comment: values.comment.trim(),
        displayName: values.displayName.trim(),
      })
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <section ref={dialogRef} tabIndex={-1} className="admin-modal admin-modal--small" role="dialog" aria-modal="true" aria-labelledby="review-form-title">
        <div className="admin-modal__header">
          <div>
            <span className="eyebrow">{editing ? 'Chỉnh sửa' : 'Chia sẻ trải nghiệm'}</span>
            <h2 id="review-form-title">{editing ? 'Sửa đánh giá' : 'Đánh giá kỳ nghỉ'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng" disabled={submitting}><X /></button>
        </div>
        {roomName && <p>Phòng <strong>{roomName}</strong></p>}
        <form className="stack-form" onSubmit={submit} noValidate>
          <div>
            <StarRatingInput value={values.rating} onChange={(rating) => setField('rating', rating)} invalid={Boolean(errors.rating)} />
            <FieldError>{errors.rating}</FieldError>
          </div>
          <label htmlFor="review-title">Tiêu đề <span>(không bắt buộc)</span>
            <input id="review-title" maxLength={REVIEW_LIMITS.title} value={values.title} onChange={(event) => setField('title', event.target.value)} placeholder="Tóm tắt trải nghiệm của bạn" aria-invalid={Boolean(errors.title)} />
            <FieldError>{errors.title}</FieldError>
          </label>
          <label htmlFor="review-comment">Nội dung <span>(không bắt buộc)</span>
            <textarea id="review-comment" rows="4" maxLength={REVIEW_LIMITS.comment} value={values.comment} onChange={(event) => setField('comment', event.target.value)} placeholder="Phòng, dịch vụ, điều bạn thích hoặc muốn cải thiện…" aria-invalid={Boolean(errors.comment)} />
            <FieldError>{errors.comment}</FieldError>
          </label>
          <label htmlFor="review-display-name">Tên hiển thị công khai
            <input id="review-display-name" maxLength={REVIEW_LIMITS.displayName} value={values.displayName} onChange={(event) => setField('displayName', event.target.value)} aria-invalid={Boolean(errors.displayName)} />
            <FieldError>{errors.displayName}</FieldError>
          </label>
          {submitError && <div className="form-alert form-alert--error" role="alert">{submitError}</div>}
          <div className="admin-modal__actions">
            <button type="button" className="button button--ghost" onClick={onClose} disabled={submitting}>Để sau</button>
            <button type="submit" className="button button--copper" disabled={submitting}>{submitting ? 'Đang gửi…' : editing ? 'Lưu thay đổi' : 'Gửi đánh giá'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
