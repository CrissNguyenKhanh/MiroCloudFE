import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminMediaManager from "./AdminMediaManager";

const mocks = vi.hoisted(() => ({
  adminList: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  replaceFile: vi.fn(),
  remove: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../api", () => ({ api: { media: mocks } }));
vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

const room = { id: "room-1", name: "CloudStay Suite" };
const image = {
  id: "media-1",
  roomId: "room-1",
  mediaType: "image",
  url: "https://cdn.test/cover.webp",
  altText: "Suite cover",
  sortOrder: 1,
  isCover: true,
  bytes: 2048,
};

describe("AdminMediaManager", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.adminList.mockResolvedValue({ data: [] });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prevalidates a file, previews it and uploads multipart through the adapter", async () => {
    const user = userEvent.setup({ applyAccept: false });
    mocks.upload.mockResolvedValue(image);
    mocks.adminList
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [image] });
    render(<AdminMediaManager room={room} onClose={vi.fn()} />);

    const picker = await screen.findByLabelText("Chọn tệp");
    await user.upload(picker, new File(["text"], "notes.txt", { type: "text/plain" }));
    expect(screen.getByText("Chỉ nhận ảnh JPEG, PNG, WebP hoặc video MP4, WebM.")).toBeVisible();
    expect(mocks.upload).not.toHaveBeenCalled();

    const file = new File(["image"], "suite.webp", { type: "image/webp" });
    await user.upload(picker, file);
    expect(screen.getByAltText("Xem trước tệp đã chọn")).toHaveAttribute("src", "blob:preview");
    await user.type(screen.getByPlaceholderText("Mô tả ảnh/video cho trợ năng"), "Suite balcony");
    await user.click(screen.getByRole("button", { name: "Tải lên" }));

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith("room-1", {
      file,
      altText: "Suite balcony",
    }));
    expect(await screen.findByAltText("Suite cover")).toBeVisible();
  });

  it("confirms deletion and reports pending storage cleanup as a successful data mutation", async () => {
    mocks.adminList
      .mockResolvedValueOnce({ data: [image] })
      .mockResolvedValueOnce({ data: [] });
    mocks.remove.mockResolvedValue({
      data: { id: image.id, deleted: true },
      storageCleanupPending: true,
    });
    render(<AdminMediaManager room={room} onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Xóa" }));
    expect(screen.getByRole("alertdialog", { name: "Xóa ảnh/video?" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("room-1", "media-1"));
    expect(mocks.showToast).toHaveBeenCalledWith(
      "Dữ liệu đã cập nhật, nhưng việc dọn file lưu trữ cũ đang chờ xử lý.",
      "info",
    );
  });
});
