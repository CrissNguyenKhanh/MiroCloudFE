export default function RoomVisual({ room, className = '', label }) {
  const palette = room?.palette ?? ['#9bb8b3', '#eadbc2', '#244f5d']
  const gradientId = `sky-${String(room?.id ?? 'room').replace(/[^a-z0-9]/gi, '')}`
  return (
    <div
      className={`room-visual ${className}`}
      role="img"
      aria-label={label ?? `Minh họa phòng ${room?.name ?? 'CloudStay'}`}
      style={{ '--room-accent': palette[0], '--room-light': palette[1], '--room-dark': palette[2] }}
    >
      <svg viewBox="0 0 800 520" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={palette[1]} />
            <stop offset="1" stopColor={palette[0]} />
          </linearGradient>
          <linearGradient id={`${gradientId}-window`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8eef0" />
            <stop offset="1" stopColor={palette[0]} />
          </linearGradient>
        </defs>
        <rect width="800" height="520" fill={`url(#${gradientId})`} />
        <rect y="350" width="800" height="170" fill="#d7c2a5" />
        <path d="M0 395 L800 350 L800 520 L0 520Z" fill="#c5a988" opacity=".65" />
        <rect x="72" y="48" width="274" height="238" rx="3" fill={`url(#${gradientId}-window)`} stroke="#f8f2e8" strokeWidth="14" />
        <line x1="209" y1="55" x2="209" y2="279" stroke="#f8f2e8" strokeWidth="8" />
        <circle cx="279" cy="105" r="28" fill="#f1c982" opacity=".9" />
        <path d="M80 230 C140 165 183 210 229 174 C272 141 311 176 339 151 L339 279 L80 279Z" fill={palette[2]} opacity=".35" />
        <rect x="385" y="260" width="334" height="154" rx="18" fill="#f8f3ea" />
        <rect x="409" y="233" width="125" height="72" rx="18" fill="#fffaf2" />
        <rect x="545" y="233" width="134" height="72" rx="18" fill="#efe1ca" />
        <path d="M385 332 Q552 298 719 332 L719 414 L385 414Z" fill={palette[2]} opacity=".9" />
        <rect x="373" y="403" width="360" height="22" rx="8" fill="#8e704f" />
        <rect x="398" y="423" width="18" height="48" rx="5" fill="#70583e" />
        <rect x="690" y="423" width="18" height="48" rx="5" fill="#70583e" />
        <rect x="255" y="305" width="72" height="112" rx="7" fill="#ad8459" />
        <path d="M291 302 C236 258 250 220 287 245 C286 198 332 196 326 245 C366 220 379 264 326 303Z" fill="#375f50" />
        <rect x="113" y="316" width="93" height="18" rx="8" fill="#f5eadc" />
        <path d="M123 316 L137 260 L183 260 L198 316Z" fill="#e4bd79" />
        <rect x="136" y="250" width="48" height="12" rx="6" fill="#fff5dc" />
      </svg>
      <span className="room-visual__label">{room?.view}</span>
    </div>
  )
}
