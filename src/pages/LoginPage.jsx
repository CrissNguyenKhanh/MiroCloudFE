import { useState } from 'react'
import { ArrowRight, KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/errors'
import { isMockMode } from '../api'
import { FieldError } from '../components/common/States'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const demoAccounts = {
  guest: { email: 'guest@cloudstay.vn', password: 'Guest123!' },
  admin: { email: 'admin@cloudstay.vn', password: 'Admin123!' },
}

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submittingFromPage, setSubmittingFromPage] = useState(false)
  const { login, isAuthenticated, isAuthenticating } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  if (isAuthenticated && !submittingFromPage) return <Navigate to="/" replace />

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setErrors((current) => ({ ...current, [event.target.name]: undefined }))
    setSubmitError('')
  }

  const fillDemo = (type) => {
    setForm(demoAccounts[type])
    setErrors({})
    setSubmitError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Vui lòng nhập email hợp lệ.'
    if (!form.password) nextErrors.password = 'Vui lòng nhập mật khẩu.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmittingFromPage(true)
    try {
      const user = await login(form)
      showToast(`Chào mừng ${user.fullName} trở lại.`)
      const intended = location.state?.from
      navigate(user.role === 'admin' && !intended ? '/admin' : intended || '/', { replace: true })
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Đăng nhập không thành công.'))
      setSubmittingFromPage(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__visual" aria-hidden="true">
        <div className="auth-page__arch"><span /><span /><span /></div>
        <div className="auth-page__quote">
          <span className="eyebrow eyebrow--light">CloudStay</span>
          <blockquote>“Bình yên bắt đầu từ một nơi khiến ta thấy mình thuộc về.”</blockquote>
        </div>
      </div>
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-card__heading">
          <span className="auth-card__icon"><KeyRound /></span>
          <span className="eyebrow">Rất vui được gặp lại</span>
          <h1 id="login-title">Đăng nhập CloudStay</h1>
          <p>Tiếp tục quản lý kỳ nghỉ và những đặt phòng của bạn.</p>
        </div>

        {isMockMode && (
          <div className="demo-accounts">
            <div className="demo-accounts__heading"><ShieldCheck size={18} /><strong>Tài khoản demo</strong></div>
            <div className="demo-accounts__actions">
              <button type="button" onClick={() => fillDemo('guest')}><UserRound size={16} /> Dùng tài khoản khách</button>
              <button type="button" onClick={() => fillDemo('admin')}><ShieldCheck size={16} /> Dùng tài khoản admin</button>
            </div>
          </div>
        )}

        <form className="stack-form" onSubmit={submit} noValidate>
          <label htmlFor="login-email">Email
            <input id="login-email" type="email" name="email" autoComplete="email" placeholder="ban@example.com" value={form.email} onChange={update} aria-invalid={Boolean(errors.email)} />
            <FieldError>{errors.email}</FieldError>
          </label>
          <label htmlFor="login-password">Mật khẩu
            <input id="login-password" type="password" name="password" autoComplete="current-password" placeholder="Nhập mật khẩu" value={form.password} onChange={update} aria-invalid={Boolean(errors.password)} />
            <FieldError>{errors.password}</FieldError>
          </label>
          {submitError && <div className="form-alert form-alert--error" role="alert">{submitError}</div>}
          <button className="button button--navy button--full" type="submit" disabled={isAuthenticating || submittingFromPage}>
            {isAuthenticating || submittingFromPage ? 'Đang đăng nhập…' : <>Đăng nhập <ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="auth-card__switch">Chưa có tài khoản? <Link to="/register" state={location.state}>Đăng ký ngay</Link></p>
      </section>
    </div>
  )
}
