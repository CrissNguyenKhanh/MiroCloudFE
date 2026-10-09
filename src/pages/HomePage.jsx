import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Clock3, Coffee, Leaf, ShieldCheck, Sparkles, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, isMockMode } from '../api'
import RoomCard from '../components/rooms/RoomCard'
import SearchForm from '../components/rooms/SearchForm'
import { ErrorState, LoadingState } from '../components/common/States'
import { getErrorMessage } from '../api/errors'

export default function HomePage() {
  const [rooms, setRooms] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  const loadRooms = async () => {
    const requestId = ++requestIdRef.current
    setStatus('loading')
    try {
      const result = await api.rooms.list()
      if (requestId !== requestIdRef.current) return
      setRooms(result.data.filter((room) => room.featured).slice(0, 3))
      setStatus('success')
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }

  useEffect(() => {
    loadRooms()
    return () => {
      requestIdRef.current += 1
    }
  }, [])

  return (
    <>
      <section className="hero">
        <div className="hero__backdrop" aria-hidden="true">
          <span className="hero__sun" />
          <span className="hero__ridge hero__ridge--one" />
          <span className="hero__ridge hero__ridge--two" />
          <span className="hero__building">
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          </span>
        </div>
        <div className="container hero__content">
          <div className="hero__copy">
            <span className="eyebrow eyebrow--light"><Sparkles size={15} /> Chạm vào một kỳ nghỉ khác biệt</span>
            <h1>Nơi nhịp sống<br />chậm lại <em>vừa đủ.</em></h1>
            <p>Phòng nghỉ tinh tế, dịch vụ tận tâm và những khoảng lặng đáng nhớ giữa lòng thành phố.</p>
          </div>
          <div className="hero__trust" aria-label="Cam kết dịch vụ">
            <span><ShieldCheck /> Xác nhận rõ ràng</span>
            <span><Clock3 /> Hỗ trợ 24/7</span>
            <span><Leaf /> Trải nghiệm bền vững</span>
          </div>
        </div>
        <div className="container hero__search-wrap">
          <SearchForm />
          {isMockMode && <p className="demo-ribbon"><span /> Bạn đang khám phá bản demo — mọi dữ liệu đều là mô phỏng.</p>}
        </div>
      </section>

      <section className="section section--rooms">
        <div className="container">
          <div className="section-heading section-heading--split">
            <div>
              <span className="eyebrow">Không gian dành riêng cho bạn</span>
              <h2>Những căn phòng được yêu thích</h2>
            </div>
            <div className="section-heading__aside">
              <p>Từ chuyến đi ngắn ngày đến kỳ nghỉ cùng gia đình, mỗi căn phòng đều mang một nhịp điệu riêng.</p>
              <Link className="text-link" to="/rooms">Khám phá tất cả <ArrowRight size={17} /></Link>
            </div>
          </div>

          {status === 'loading' && <LoadingState label="Đang chuẩn bị những căn phòng nổi bật…" />}
          {status === 'error' && <ErrorState message={error} onRetry={loadRooms} />}
          {status === 'success' && (
            <div className="room-grid room-grid--featured">
              {rooms.map((room) => <RoomCard room={room} key={room.id} />)}
            </div>
          )}
        </div>
      </section>

      <section className="section experience-section">
        <div className="container experience-grid">
          <div className="experience-visual" aria-hidden="true">
            <div className="experience-visual__arch">
              <span className="experience-visual__sun" />
              <span className="experience-visual__water" />
              <span className="experience-visual__chair" />
              <span className="experience-visual__plant" />
            </div>
            <blockquote>“Một nơi để trở về, ngay cả khi bạn chỉ vừa đặt chân đến.”</blockquote>
          </div>
          <div className="experience-copy">
            <span className="eyebrow">Hơn cả một phòng nghỉ</span>
            <h2>Từng chi tiết nhỏ, một cảm giác thật lớn.</h2>
            <p>CloudStay được tạo nên cho những người trân trọng sự yên tĩnh, thẩm mỹ và một trải nghiệm liền mạch từ lúc tìm phòng đến khi rời đi.</p>
            <div className="experience-list">
              <div><Coffee /><span><strong>Bữa sáng địa phương</strong><small>Phục vụ mỗi sáng từ 06:30</small></span></div>
              <div><Waves /><span><strong>Hồ bơi tầng thượng</strong><small>Khoảng trời riêng giữa thành phố</small></span></div>
              <div><Leaf /><span><strong>Chăm sóc có ý thức</strong><small>Tiện nghi thân thiện môi trường</small></span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section numbers-section">
        <div className="container numbers-grid">
          <div><strong>6</strong><span>hạng phòng</span></div>
          <div><strong>24/7</strong><span>hỗ trợ tại quầy</span></div>
          <div><strong>4.9</strong><span>điểm trải nghiệm mẫu</span></div>
          <div><strong>0</strong><span>phí thanh toán ẩn</span></div>
        </div>
      </section>
    </>
  )
}
