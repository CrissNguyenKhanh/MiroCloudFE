export const MEDIA_LIMITS = {
  imageBytes: 5 * 1024 * 1024,
  videoBytes: 30 * 1024 * 1024,
  count: 20,
  altText: 200,
  minSortOrder: 1,
  maxSortOrder: 10_000,
};

export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";

const allowedTypes = new Map([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["video/mp4", "video"],
  ["video/webm", "video"],
]);

function mediaOrder(item) {
  const value = Number(item?.sortOrder);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function hasUrl(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function sortRoomMedia(items = []) {
  return [...items].sort(
    (left, right) =>
      Number(Boolean(right?.isCover)) - Number(Boolean(left?.isCover)) ||
      mediaOrder(left) - mediaOrder(right),
  );
}

export function selectRoomCardMedia(items = []) {
  const ordered = sortRoomMedia(items);
  const images = ordered.filter(
    (item) => item?.mediaType?.toLowerCase() === "image" && hasUrl(item.url),
  );
  const image = images.find((item) => item.isCover) ?? images[0];
  if (image) {
    return {
      ...image,
      previewUrl: hasUrl(image.thumbnailUrl) ? image.thumbnailUrl : image.url,
      originalUrl: image.url,
      previewKind: "image",
    };
  }

  const video = ordered.find(
    (item) =>
      item?.mediaType?.toLowerCase() === "video" && hasUrl(item.thumbnailUrl),
  );
  return video
    ? {
        ...video,
        previewUrl: video.thumbnailUrl,
        originalUrl: null,
        previewKind: "video-thumbnail",
      }
    : null;
}

export function mediaTypeForFile(file) {
  return file ? allowedTypes.get(file.type) ?? null : null;
}

export function validateMediaFile(file) {
  if (!file) return "Vui lòng chọn ảnh hoặc video.";
  const mediaType = mediaTypeForFile(file);
  if (!mediaType) return "Chỉ nhận ảnh JPEG, PNG, WebP hoặc video MP4, WebM.";
  const limit = mediaType === "image" ? MEDIA_LIMITS.imageBytes : MEDIA_LIMITS.videoBytes;
  if (file.size > limit) {
    return mediaType === "image" ? "Ảnh tối đa 5 MB." : "Video tối đa 30 MB.";
  }
  return "";
}

export function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}

export function mediaErrorMessage(error) {
  const messages = {
    MEDIA_NOT_CONFIGURED: "Chức năng tải ảnh/video chưa được cấu hình trên máy chủ.",
    MEDIA_LIMIT_REACHED: "Phòng đã đạt giới hạn 20 ảnh/video.",
    FILE_TOO_LARGE: "Tệp vượt quá dung lượng cho phép.",
    UNSUPPORTED_MEDIA_TYPE: "Định dạng tệp không được hỗ trợ.",
    MEDIA_NOT_FOUND: "Ảnh/video không còn tồn tại. Danh sách sẽ được tải lại.",
    COVER_MUST_BE_IMAGE: "Chỉ ảnh mới có thể được chọn làm ảnh bìa.",
    MEDIA_UPLOAD_FAILED: "Không thể tải tệp lên kho lưu trữ. Vui lòng thử lại.",
  };
  return messages[error?.code] ?? error?.message ?? "Không thể hoàn tất thao tác ảnh/video.";
}
