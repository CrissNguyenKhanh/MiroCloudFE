import { useEffect, useState } from "react";
import { loadRoomMedia } from "../../api/mediaCache";
import { getRoomFallbackImage } from "../../data/roomFallbackImages";
import { selectRoomCardMedia } from "../../utils/media";
import RoomVisual from "./RoomVisual";

function fallbackDisplay(room) {
  const fallback = getRoomFallbackImage(room);
  return fallback ? { ...fallback, kind: "illustration", backupSrc: null } : null;
}

function officialDisplay(media, room) {
  if (!media) return null;
  return {
    src: media.previewUrl,
    backupSrc:
      media.originalUrl && media.originalUrl !== media.previewUrl
        ? media.originalUrl
        : null,
    alt:
      media.altText ||
      (media.previewKind === "video-thumbnail"
        ? `Ảnh xem trước video phòng ${room.name}`
        : `Phòng ${room.name}`),
    kind: "official",
  };
}

export default function RoomCardImage({ room }) {
  const [display, setDisplay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setDisplay(null);
    setLoading(true);

    loadRoomMedia(room.id)
      .then((items) => {
        if (!active) return;
        setDisplay(
          officialDisplay(selectRoomCardMedia(items), room) ??
            fallbackDisplay(room),
        );
      })
      .catch(() => {
        if (active) setDisplay(fallbackDisplay(room));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [room.id, room.name, room.type]);

  const handleError = () => {
    setDisplay((current) => {
      if (current?.backupSrc) {
        return { ...current, src: current.backupSrc, backupSrc: null };
      }
      if (current?.kind === "official") return fallbackDisplay(room);
      return null;
    });
  };

  if (loading) {
    return (
      <div
        className="room-card-image room-card-image--loading"
        role="status"
        aria-label={`Đang tải ảnh phòng ${room.name}`}
      />
    );
  }

  if (!display) {
    return (
      <div className="room-card-image room-card-image--fallback">
        <RoomVisual room={room} label={`Minh họa phòng ${room.name}`} />
      </div>
    );
  }

  return (
    <div className={`room-card-image room-card-image--${display.kind}`}>
      <img
        src={display.src}
        alt={display.alt}
        loading="lazy"
        decoding="async"
        onError={handleError}
      />
      {display.kind === "illustration" && (
        <span className="room-card-image__source">Ảnh minh họa</span>
      )}
    </div>
  );
}
