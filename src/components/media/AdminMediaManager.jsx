import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon,
  LoaderCircle,
  Save,
  Star,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { api } from "../../api";
import { invalidateRoomMedia } from "../../api/mediaCache";
import { useToast } from "../../contexts/ToastContext";
import useDialogAccessibility from "../../hooks/useDialogAccessibility";
import {
  formatFileSize,
  MEDIA_ACCEPT,
  MEDIA_LIMITS,
  mediaErrorMessage,
  mediaTypeForFile,
  validateMediaFile,
} from "../../utils/media";
import { EmptyState, ErrorState, LoadingState } from "../common/States";

function useObjectUrl(file) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") {
      setUrl("");
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function FilePreview({ file, url, alt = "Xem trước tệp đã chọn" }) {
  if (!file || !url) return null;
  return mediaTypeForFile(file) === "video" ? (
    <video className="admin-media-preview" src={url} controls preload="metadata" aria-label={alt} />
  ) : (
    <img className="admin-media-preview" src={url} alt={alt} />
  );
}

function cleanupMessage(result) {
  return result?.storageCleanupPending
    ? "Dữ liệu đã cập nhật, nhưng việc dọn file lưu trữ cũ đang chờ xử lý."
    : "";
}

export default function AdminMediaManager({ room, onClose }) {
  const [media, setMedia] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceError, setReplaceError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [drafts, setDrafts] = useState({});
  const uploadPreview = useObjectUrl(uploadFile);
  const replacePreview = useObjectUrl(replaceFile);
  const { showToast } = useToast();
  const managerRef = useDialogAccessibility({
    onClose,
    closeDisabled: Boolean(busyId),
  });

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const result = await api.media.adminList(room.id);
      setMedia(result.data);
      setDrafts(Object.fromEntries(result.data.map((item) => [item.id, {
        altText: item.altText ?? "",
        sortOrder: item.sortOrder ?? 1,
      }])));
      setStatus("success");
    } catch (loadError) {
      setError(mediaErrorMessage(loadError));
      setStatus("error");
    }
  }, [room.id]);

  useEffect(() => { load(); }, [load]);

  const remaining = Math.max(0, MEDIA_LIMITS.count - media.length);
  const ordered = useMemo(
    () => [...media].sort((left, right) =>
      Number(right.isCover) - Number(left.isCover) || left.sortOrder - right.sortOrder),
    [media],
  );

  const chooseUpload = (file) => {
    const nextError = validateMediaFile(file);
    setUploadFile(nextError ? null : file);
    setUploadError(nextError);
    setActionError("");
  };

  const upload = async (event) => {
    event.preventDefault();
    const fileError = validateMediaFile(uploadFile);
    if (fileError) return setUploadError(fileError);
    if (uploadAlt.trim().length > MEDIA_LIMITS.altText)
      return setUploadError("Alt text tối đa 200 ký tự.");
    setBusyId("upload");
    setActionError("");
    try {
      await api.media.upload(room.id, { file: uploadFile, altText: uploadAlt.trim() });
      invalidateRoomMedia(room.id);
      setUploadFile(null);
      setUploadAlt("");
      showToast("Đã tải ảnh/video lên phòng.");
      await load();
    } catch (uploadFailure) {
      setActionError(mediaErrorMessage(uploadFailure));
    } finally {
      setBusyId("");
    }
  };

  const updateDraft = (id, field, value) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  const saveMetadata = async (item) => {
    const draft = drafts[item.id] ?? {};
    const sortOrder = Number(draft.sortOrder);
    if (String(draft.altText ?? "").trim().length > MEDIA_LIMITS.altText)
      return setActionError("Alt text tối đa 200 ký tự.");
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 10_000)
      return setActionError("Thứ tự hiển thị phải là số nguyên từ 1 đến 10000.");
    setBusyId(item.id);
    setActionError("");
    try {
      await api.media.update(room.id, item.id, {
        altText: String(draft.altText ?? "").trim(),
        sortOrder,
      });
      invalidateRoomMedia(room.id);
      showToast("Đã cập nhật mô tả và thứ tự media.");
      await load();
    } catch (updateError) {
      setActionError(mediaErrorMessage(updateError));
      if (updateError?.code === "MEDIA_NOT_FOUND") await load();
    } finally {
      setBusyId("");
    }
  };

  const setCover = async (item) => {
    if (item.mediaType !== "image") return;
    setBusyId(item.id);
    setActionError("");
    try {
      await api.media.update(room.id, item.id, { isCover: true });
      invalidateRoomMedia(room.id);
      showToast("Đã đặt ảnh bìa cho phòng.");
      await load();
    } catch (coverError) {
      setActionError(mediaErrorMessage(coverError));
    } finally {
      setBusyId("");
    }
  };

  const chooseReplacement = (file) => {
    const nextError = validateMediaFile(file);
    setReplaceFile(nextError ? null : file);
    setReplaceError(nextError);
  };

  const replace = async () => {
    const fileError = validateMediaFile(replaceFile);
    if (fileError) return setReplaceError(fileError);
    setBusyId(replaceTarget.id);
    setActionError("");
    try {
      const result = await api.media.replaceFile(room.id, replaceTarget.id, {
        file: replaceFile,
        altText: drafts[replaceTarget.id]?.altText,
      });
      invalidateRoomMedia(room.id);
      setReplaceTarget(null);
      setReplaceFile(null);
      showToast(cleanupMessage(result) || "Đã thay file media.", result.storageCleanupPending ? "info" : "success");
      await load();
    } catch (replaceFailure) {
      setReplaceError(mediaErrorMessage(replaceFailure));
    } finally {
      setBusyId("");
    }
  };

  const remove = async () => {
    setBusyId(deleteTarget.id);
    setActionError("");
    try {
      const result = await api.media.remove(room.id, deleteTarget.id);
      invalidateRoomMedia(room.id);
      setDeleteTarget(null);
      showToast(cleanupMessage(result) || "Đã xóa media khỏi phòng.", result.storageCleanupPending ? "info" : "success");
      await load();
    } catch (deleteError) {
      setActionError(mediaErrorMessage(deleteError));
      if (deleteError?.code === "MEDIA_NOT_FOUND") await load();
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busyId && onClose()}>
      <section ref={managerRef} tabIndex={-1} className="admin-modal admin-media-manager" role="dialog" aria-modal="true" aria-labelledby="media-manager-title">
        <div className="admin-modal__header">
          <div><span className="eyebrow">Room media</span><h2 id="media-manager-title">Ảnh/video · {room.name}</h2><p>{media.length}/{MEDIA_LIMITS.count} media · còn {remaining} vị trí</p></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={Boolean(busyId)} aria-label="Đóng quản lý ảnh/video"><X /></button>
        </div>

        <form className="admin-media-upload" onSubmit={upload}>
          <div>
            <strong><Upload size={18} /> Tải media mới</strong>
            <small>JPEG/PNG/WebP tối đa 5 MB · MP4/WebM tối đa 30 MB</small>
          </div>
          <label className="file-picker">Chọn tệp<input type="file" accept={MEDIA_ACCEPT} onChange={(event) => chooseUpload(event.target.files?.[0])} /></label>
          <label>Alt text<input value={uploadAlt} maxLength={200} onChange={(event) => setUploadAlt(event.target.value)} placeholder="Mô tả ảnh/video cho trợ năng" /></label>
          <button className="button button--copper" type="submit" disabled={!uploadFile || Boolean(busyId) || remaining === 0}>{busyId === "upload" ? "Đang tải…" : "Tải lên"}</button>
          {uploadFile && <div className="admin-media-file-info"><FilePreview file={uploadFile} url={uploadPreview} /><span><strong>{uploadFile.name}</strong><small>{formatFileSize(uploadFile.size)}</small></span></div>}
          {uploadError && <p className="field-error admin-media-upload__error" role="alert">{uploadError}</p>}
        </form>

        {actionError && <p className="inline-notice inline-notice--warning" role="alert">{actionError}</p>}
        {status === "loading" && <LoadingState compact label="Đang tải media của phòng…" />}
        {status === "error" && <ErrorState message={error} onRetry={load} />}
        {status === "success" && ordered.length === 0 && <EmptyState title="Phòng chưa có ảnh/video" message="Tải media đầu tiên để thay thế hình minh họa mặc định." />}
        {status === "success" && ordered.length > 0 && (
          <div className="admin-media-list">
            {ordered.map((item) => (
              <article className="admin-media-item" key={item.id}>
                <div className="admin-media-item__visual">
                  {item.mediaType === "video" ? <video src={item.url} controls preload="metadata" /> : <img src={item.url} alt={item.altText || ""} />}
                  <span>{item.mediaType === "video" ? <Video /> : <ImageIcon />} {item.mediaType}</span>
                  {item.isCover && <em><Star /> Ảnh bìa</em>}
                </div>
                <div className="admin-media-item__form">
                  <label>Alt text<input maxLength={200} value={drafts[item.id]?.altText ?? ""} onChange={(event) => updateDraft(item.id, "altText", event.target.value)} /></label>
                  <label>Thứ tự<input type="number" min="1" max="10000" value={drafts[item.id]?.sortOrder ?? 1} onChange={(event) => updateDraft(item.id, "sortOrder", event.target.value)} /></label>
                  <small>{formatFileSize(item.bytes)}{item.width ? ` · ${item.width}×${item.height}` : ""}</small>
                  <div className="admin-media-item__actions">
                    <button type="button" onClick={() => saveMetadata(item)} disabled={Boolean(busyId)}><Save /> Lưu</button>
                    {item.mediaType === "image" && !item.isCover && <button type="button" onClick={() => setCover(item)} disabled={Boolean(busyId)}><Star /> Đặt ảnh bìa</button>}
                    <label className="text-button">Thay file<input type="file" accept={MEDIA_ACCEPT} onChange={(event) => { setReplaceTarget(item); chooseReplacement(event.target.files?.[0]); }} /></label>
                    <button className="text-button text-button--danger" type="button" onClick={() => setDeleteTarget(item)} disabled={Boolean(busyId)}><Trash2 /> Xóa</button>
                  </div>
                  {busyId === item.id && <LoaderCircle className="spin" aria-label="Đang xử lý" />}
                </div>
              </article>
            ))}
          </div>
        )}

        {replaceTarget && (
          <div className="admin-media-confirm" role="alertdialog" aria-modal="true" aria-labelledby="replace-media-title">
            <div><h3 id="replace-media-title">Thay file media</h3><p>ID được giữ nguyên; file cũ chỉ được dọn sau khi backend cập nhật DB.</p></div>
            {replaceFile && <div className="admin-media-file-info"><FilePreview file={replaceFile} url={replacePreview} /><span><strong>{replaceFile.name}</strong><small>{formatFileSize(replaceFile.size)}</small></span></div>}
            {replaceError && <p className="field-error" role="alert">{replaceError}</p>}
            <div><button className="button button--ghost" type="button" onClick={() => { setReplaceTarget(null); setReplaceFile(null); setReplaceError(""); }}>Hủy</button><button className="button button--navy" type="button" onClick={replace} disabled={!replaceFile || Boolean(busyId)}>Xác nhận thay file</button></div>
          </div>
        )}
        {deleteTarget && (
          <div className="admin-media-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-media-title">
            <div><h3 id="delete-media-title">Xóa ảnh/video?</h3><p>Metadata sẽ bị xóa khỏi phòng. Backend sẽ xử lý file lưu trữ tương ứng.</p></div>
            <div><button className="button button--ghost" type="button" onClick={() => setDeleteTarget(null)}>Giữ lại</button><button className="button button--danger" type="button" onClick={remove} disabled={Boolean(busyId)}>Xác nhận xóa</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
