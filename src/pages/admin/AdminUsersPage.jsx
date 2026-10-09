import { useCallback, useEffect, useState } from 'react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/States'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState(null)
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()

  const loadUsers = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const result = await api.identity.adminListUsers()
      setUsers(result.data)
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const changeStatus = async (target) => {
    const nextStatus = target.status === 'locked' ? 'ACTIVE' : 'LOCKED'
    const action = nextStatus === 'LOCKED' ? 'khóa' : 'mở khóa'
    if (!window.confirm(`Xác nhận ${action} tài khoản ${target.email}?`)) return

    setPendingId(target.id)
    try {
      const updated = await api.identity.updateUserStatus(target.id, nextStatus)
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
      showToast(`Đã ${action} tài khoản ${target.email}.`)
    } catch (updateError) {
      showToast(getErrorMessage(updateError), 'error')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><span className="eyebrow">Identity access</span><h1>Tài khoản</h1><p>Xem người dùng và cập nhật trạng thái ACTIVE/LOCKED bằng quyền admin.</p></div>
      </header>

      {status === 'loading' && <LoadingState label="Đang tải tài khoản…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadUsers} />}
      {status === 'success' && users.length === 0 && <EmptyState title="Chưa có tài khoản" message="Identity Service chưa trả về người dùng nào." />}
      {status === 'success' && users.length > 0 && (
        <div className="admin-panel admin-panel--flush">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Tạo lúc</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {users.map((account) => {
                  const isCurrentUser = account.id === currentUser?.id
                  const isLocked = account.status === 'locked'
                  return (
                    <tr key={account.id}>
                      <td><strong>{account.fullName || 'Chưa có họ tên'}</strong><small>{account.email}</small></td>
                      <td className="capitalize">{account.role || 'customer'}</td>
                      <td><span className={`availability-pill${!isLocked ? ' availability-pill--on' : ''}`}>{isLocked ? 'LOCKED' : 'ACTIVE'}</span></td>
                      <td>{account.createdAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(account.createdAt)) : '—'}</td>
                      <td>
                        <button
                          className={isLocked ? 'table-secondary-action' : 'table-danger-action'}
                          type="button"
                          disabled={pendingId === account.id || isCurrentUser}
                          title={isCurrentUser ? 'Không khóa tài khoản đang sử dụng trong giao diện này.' : undefined}
                          onClick={() => changeStatus(account)}
                        >
                          {isLocked ? <ShieldCheck /> : <LockKeyhole />}
                          {pendingId === account.id ? 'Đang cập nhật…' : isLocked ? 'Mở khóa' : 'Khóa'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
