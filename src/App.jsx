import { Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import RoomDetailPage from './pages/RoomDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CheckoutPage from './pages/CheckoutPage'
import BookingResultPage from './pages/BookingResultPage'
import MyBookingsPage from './pages/MyBookingsPage'
import NotificationsPage from './pages/NotificationsPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminRoomsPage from './pages/admin/AdminRoomsPage'
import AdminBookingsPage from './pages/admin/AdminBookingsPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminOutboxPage from './pages/admin/AdminOutboxPage'
import ForbiddenPage from './pages/ForbiddenPage'
import NotFoundPage from './pages/NotFoundPage'
import { AdminRoute, ProtectedRoute } from './routes/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="rooms" element={<SearchPage />} />
        <Route path="rooms/:roomId" element={<RoomDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="checkout/:roomId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="booking/success/:bookingId" element={<ProtectedRoute><BookingResultPage /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="rooms" element={<AdminRoomsPage />} />
        <Route path="bookings" element={<AdminBookingsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="outbox" element={<AdminOutboxPage />} />
      </Route>
    </Routes>
  )
}
