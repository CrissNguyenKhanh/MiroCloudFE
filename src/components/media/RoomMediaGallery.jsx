import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Expand, ImageOff, Play, RotateCcw, X } from "lucide-react";
import { api } from "../../api";
import useDialogAccessibility from "../../hooks/useDialogAccessibility";
import { sortRoomMedia } from "../../utils/media";
import RoomVisual from "../rooms/RoomVisual";

function PlaceholderGallery({ room }) {
  const palette =
    Array.isArray(room.palette) && room.palette.length >= 3
      ? room.palette
      : ["#9bb8b3", "#eadbc2", "#244f5d"];
  return (
    <div className="room-detail__visual-grid">
      <RoomVisual room={room} className="room-visual--detail" />
      <RoomVisual room={{ ...room, view: "Góc thư giãn", palette: [palette[1], palette[0], palette[2]] }} className="room-visual--secondary" />
      <RoomVisual room={{ ...room, view: "Phòng tắm", palette: [palette[0], "#f1ece2", "#46626a"] }} className="room-visual--secondary" />
    </div>
  );
}

export default function RoomMediaGallery({ room }) {
  const [media, setMedia] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("loading");
  const [failedIds, setFailedIds] = useState(new Set());
  const [lightbox, setLightbox] = useState(false);
  const requestRef = useRef(0);
  const lightboxRef = useDialogAccessibility({
    open: lightbox,
    onClose: () => setLightbox(false),
  });

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setStatus("loading");
    try {
      const result = await api.media.listForRoom(room.id);
      if (requestId !== requestRef.current) return;
      const ordered = sortRoomMedia(result.data);
      setMedia(ordered);
      setSelectedId((current) =>
        ordered.some((item) => item.id === current) ? current : ordered[0]?.id ?? null,
      );
      setFailedIds(new Set());
      setStatus("success");
    } catch {
      if (requestId !== requestRef.current) return;
      setStatus("error");
    }
  }, [room.id]);

  useEffect(() => {
    load();
    return () => { requestRef.current += 1; };
  }, [load]);

  const visibleMedia = useMemo(
    () => media.filter((item) => !failedIds.has(item.id)),
    [failedIds, media],
  );
  const selected =
    visibleMedia.find((item) => item.id === selectedId) ?? visibleMedia[0] ?? null;

  const markFailed = (id) => {
    setFailedIds((current) => new Set([...current, id]));
    setSelectedId((current) => (current === id ? null : current));
  };

  if (status === "loading") {
    return <div className="media-gallery media-gallery--loading"><PlaceholderGallery room={room} /><span>Đang tải ảnh/video…</span></div>;
  }
  if (!selected) {
    return (
      <div className="media-gallery media-gallery--fallback">
        <PlaceholderGallery room={room} />
        {status === "error" && (
          <button className="media-gallery__retry" type="button" onClick={load}>
            <RotateCcw size={15} /> Không tải được media · Thử lại
          </button>
        )}
        {status === "success" && media.length > 0 && (
          <span className="media-gallery__retry"><ImageOff size={15} /> Ảnh/video không thể hiển thị</span>
        )}
      </div>
    );
  }

  return (
    <section className="media-gallery" aria-label={`Ảnh và video phòng ${room.name}`}>
      <div className="media-gallery__stage">
        {selected.mediaType === "video" ? (
          <video
            key={selected.id}
            controls
            preload="metadata"
            poster={selected.thumbnailUrl || undefined}
            aria-label={selected.altText || `Video phòng ${room.name}`}
            onError={() => markFailed(selected.id)}
          >
            <source src={selected.url} />
            Trình duyệt không hỗ trợ video HTML5.
          </video>
        ) : (
          <button type="button" onClick={() => setLightbox(true)} aria-label="Xem ảnh kích thước lớn">
            <img src={selected.url} alt={selected.altText || `Phòng ${room.name}`} onError={() => markFailed(selected.id)} />
            <span><Expand size={17} /> Xem ảnh lớn</span>
          </button>
        )}
        {selected.isCover && <em>Ảnh bìa</em>}
      </div>
      {visibleMedia.length > 1 && (
        <div className="media-gallery__thumbs" aria-label="Chọn ảnh hoặc video">
          {visibleMedia.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === selected.id ? "media-thumb media-thumb--active" : "media-thumb"}
              onClick={() => setSelectedId(item.id)}
              aria-label={item.altText || `Chọn ${item.mediaType === "video" ? "video" : "ảnh"}`}
              aria-pressed={item.id === selected.id}
            >
              <img src={item.thumbnailUrl || item.url} alt="" onError={() => markFailed(item.id)} />
              {item.mediaType === "video" && <span><Play size={16} /></span>}
            </button>
          ))}
        </div>
      )}
      {lightbox && selected.mediaType === "image" && (
        <div ref={lightboxRef} tabIndex={-1} className="media-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh phòng kích thước lớn" onMouseDown={(event) => event.target === event.currentTarget && setLightbox(false)}>
          <button className="icon-button" type="button" onClick={() => setLightbox(false)} aria-label="Đóng ảnh lớn"><X /></button>
          <img src={selected.url} alt={selected.altText || `Phòng ${room.name}`} />
        </div>
      )}
    </section>
  );
}

export { PlaceholderGallery };
