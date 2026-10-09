import { useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/errors'
import { isMockMode } from '../api'
import { FieldError } from '../components/common/States'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submittingFromPage, setSubmittingFromPage] = useState(false)
  const { register, isAuthenticated, isAuthenticating } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  if (isAuthenticated && !submittingFromPage) return <Navigate to="/" replace />

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setErrors((current) => ({ ...current, [event.target.name]: undefined }))
    setSubmitError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (form.fullName.trim().length < 2) nextErrors.fullName = 'Họ tên cần có ít nhất 2 ký tự.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Vui lòng nhập email hợp lệ.'
    if (form.password.length < 8) nextErrors.password = 'Mật khẩu cần có ít nhất 8 ký tự.'
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Mật khẩu nhập lại chưa khớp.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmittingFromPage(true)
    try {
      const result = await register(form)
      if (result?.requiresLogin) {
        showToast('Tài khoản đã được tạo. Vui lòng đăng nhập để tiếp tục.')
        navigate('/login', {
          replace: true,
          state: {
            ...location.state,
            registeredEmail: form.email.trim(),
            registrationSucceeded: true,
          },
        })
      } else {
        showToast('Tài khoản đã được tạo.')
        navigate(location.state?.from || '/', { replace: true })
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể tạo tài khoản.'))
      setSubmittingFromPage(false)
    }
  }

  return (
    <div className="auth-page auth-page--register">
      <div className="auth-page__visual" aria-hidden="true">
        <div className="auth-page__arch"><span /><span /><span /></div>
        <div className="auth-page__quote">
          <span className="eyebrow eyebrow--light">Bắt đầu hành trình</span>
          <blockquote>“Những ngày đáng nhớ thường bắt đầu bằng một lựa chọn rất nhỏ.”</blockquote>
        </div>
      </div>
      <section className="auth-card" aria-labelledby="register-title">
        <div className="auth-card__heading">
          <span className="auth-card__icon"><Sparkles /></span>
          <span className="eyebrow">Thành viên mới</span>
          <h1 id="register-title">Tạo tài khoản</h1>
          <p>Đăng ký để đặt phòng và theo dõi kỳ nghỉ dễ dàng hơn.</p>
        </div>
        <form className="stack-form" onSubmit={submit} noValidate>
          <label htmlFor="register-name">Họ và tên
            <input id="register-name" name="fullName" autoComplete="name" placeholder="Nguyễn Minh An" value={form.fullName} onChange={update} aria-invalid={Boolean(errors.fullName)} />
            <FieldError>{errors.fullName}</FieldError>
          </label>
          <div className={`form-grid${isMockMode ? ' form-grid--two' : ''}`}>
            <label htmlFor="register-email">Email
              <input id="register-email" type="email" name="email" autoComplete="email" placeholder="ban@example.com" value={form.email} onChange={update} aria-invalid={Boolean(errors.email)} />
              <FieldError>{errors.email}</FieldError>
            </label>
            {isMockMode && (
              <label htmlFor="register-phone">Số điện thoại
                <input id="register-phone" type="tel" name="phone" autoComplete="tel" placeholder="090 123 4567" value={form.phone} onChange={update} />
              </label>
            )}
          </div>
          <div className="form-grid form-grid--two">
            <label htmlFor="register-password">Mật khẩu
              <input id="register-password" type="password" name="password" autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" value={form.password} onChange={update} aria-invalid={Boolean(errors.password)} />
              <FieldError>{errors.password}</FieldError>
            </label>
            <label htmlFor="register-confirm">Nhập lại mật khẩu
              <input id="register-confirm" type="password" name="confirmPassword" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={form.confirmPassword} onChange={update} aria-invalid={Boolean(errors.confirmPassword)} />
              <FieldError>{errors.confirmPassword}</FieldError>
            </label>
          </div>
          {submitError && <div className="form-alert form-alert--error" role="alert">{submitError}</div>}
          <p className="form-legal">{isMockMode ? 'Bằng việc đăng ký, bạn đồng ý sử dụng dữ liệu mô phỏng trong phiên bản demo này.' : 'Backend hiện chỉ lưu họ tên, email và mật khẩu; số điện thoại chưa được hỗ trợ.'}</p>
          <button className="button button--navy button--full" type="submit" disabled={isAuthenticating || submittingFromPage}>
            {isAuthenticating || submittingFromPage ? 'Đang tạo tài khoản…' : <>Tạo tài khoản <ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="auth-card__switch">Đã có tài khoản? <Link to="/login" state={location.state}>Đăng nhập</Link></p>
      </section>
    </div>
  )
}
