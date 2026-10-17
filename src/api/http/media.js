import {
  asCollection,
  encodeId,
  fromApi,
  normalizeMedia,
} from "./mapping";

function mapMediaCollection(payload) {
  const collection = asCollection(payload, ["media"]);
  return { ...collection, data: collection.data.map(normalizeMedia) };
}

function mediaForm(file, altText) {
  const body = new FormData();
  body.append("file", file);
  if (altText !== undefined) body.append("alt_text", altText);
  return body;
}

function mutationResult(payload) {
  const mapped = fromApi(payload) ?? {};
  return {
    data: normalizeMedia(mapped.data),
    storageCleanupPending: Boolean(mapped.storageCleanupPending),
  };
}

export function createMediaHttpApi(request) {
  return {
    async listForRoom(roomId) {
      return mapMediaCollection(
        await request(`/api/v1/rooms/${encodeId(roomId)}/media`),
      );
    },

    async adminList(roomId) {
      return mapMediaCollection(
        await request(`/api/v1/admin/rooms/${encodeId(roomId)}/media`),
      );
    },

    async upload(roomId, { file, altText = "" }) {
      const response = await request(
        `/api/v1/admin/rooms/${encodeId(roomId)}/media`,
        { method: "POST", body: mediaForm(file, altText) },
      );
      return normalizeMedia(response);
    },

    async replaceFile(roomId, mediaId, { file, altText }) {
      const response = await request(
        `/api/v1/admin/rooms/${encodeId(roomId)}/media/${encodeId(mediaId)}/file`,
        {
          method: "PUT",
          body: mediaForm(file, altText),
          preserveEnvelope: true,
        },
      );
      return mutationResult(response);
    },

    async update(roomId, mediaId, patch) {
      const body = {};
      if (patch.altText !== undefined) body.alt_text = patch.altText;
      if (patch.sortOrder !== undefined) body.sort_order = Number(patch.sortOrder);
      if (patch.isCover !== undefined) body.is_cover = Boolean(patch.isCover);
      const response = await request(
        `/api/v1/admin/rooms/${encodeId(roomId)}/media/${encodeId(mediaId)}`,
        { method: "PATCH", body },
      );
      return normalizeMedia(response);
    },

    async remove(roomId, mediaId) {
      const response = await request(
        `/api/v1/admin/rooms/${encodeId(roomId)}/media/${encodeId(mediaId)}`,
        { method: "DELETE", preserveEnvelope: true },
      );
      return mutationResult(response);
    },
  };
}

export { mapMediaCollection, mediaForm, mutationResult };
