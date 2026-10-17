import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listForRoom: vi.fn() }));
vi.mock("../../api", () => ({ api: { media: mocks } }));

import { clearRoomMediaCache } from "../../api/mediaCache";
import RoomCardImage from "./RoomCardImage";

const room = {
  id: "room-1",
  name: "CloudStay Suite",
  type: "suite",
  view: "Thành phố",
  palette: ["#79967d", "#e8dfc9", "#173f39"],
};

function image(id, { cover = false, order = 1 } = {}) {
  return {
    id,
    mediaType: "image",
    url: `https://cdn.test/${id}.webp`,
    thumbnailUrl: `https://cdn.test/${id}-thumb.webp`,
    altText: `Ảnh ${id}`,
    sortOrder: order,
    isCover: cover,
  };
}

describe("RoomCardImage", () => {
  beforeEach(() => {
    clearRoomMediaCache();
    mocks.listForRoom.mockReset();
  });

  it("uses the backend cover image even when it has a later sort order", async () => {
    mocks.listForRoom.mockResolvedValue({
      data: [image("first", { order: 1 }), image("cover", { cover: true, order: 9 })],
    });
    render(<RoomCardImage room={room} />);

    expect(await screen.findByRole("img", { name: "Ảnh cover" })).toHaveAttribute(
      "src",
      "https://cdn.test/cover-thumb.webp",
    );
  });

  it("uses the first sorted image when no cover exists", async () => {
    mocks.listForRoom.mockResolvedValue({
      data: [image("later", { order: 8 }), image("earlier", { order: 2 })],
    });
    render(<RoomCardImage room={room} />);
    expect(await screen.findByRole("img", { name: "Ảnh earlier" })).toBeVisible();
  });

  it("prefers an image over video and uses a video thumbnail only when needed", async () => {
    const video = {
      id: "tour",
      mediaType: "video",
      url: "https://cdn.test/tour.webm",
      thumbnailUrl: "https://cdn.test/tour.jpg",
      altText: "Video tour",
      sortOrder: 1,
      isCover: false,
    };
    mocks.listForRoom.mockResolvedValueOnce({ data: [video, image("photo", { order: 2 })] });
    const { unmount } = render(<RoomCardImage room={room} />);
    expect(await screen.findByRole("img", { name: "Ảnh photo" })).toBeVisible();

    unmount();
    clearRoomMediaCache();
    mocks.listForRoom.mockResolvedValueOnce({ data: [video] });
    render(<RoomCardImage room={{ ...room, id: "room-video" }} />);
    expect(await screen.findByRole("img", { name: "Video tour" })).toHaveAttribute(
      "src",
      "https://cdn.test/tour.jpg",
    );
  });

  it.each([
    ["empty media", () => Promise.resolve({ data: [] })],
    ["media API failure", () => Promise.reject(new Error("offline"))],
  ])("uses a licensed local illustration for %s", async (_label, request) => {
    mocks.listForRoom.mockImplementation(request);
    render(<RoomCardImage room={room} />);
    expect(
      await screen.findByRole("img", { name: "Ảnh minh họa hạng phòng CloudStay Suite" }),
    ).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("Ảnh minh họa")).toBeVisible();
  });

  it("falls back safely when both the backend image and local photo fail", async () => {
    mocks.listForRoom.mockResolvedValue({ data: [image("broken", { cover: true })] });
    render(<RoomCardImage room={room} />);

    const thumbnail = await screen.findByRole("img", { name: "Ảnh broken" });
    fireEvent.error(thumbnail);
    expect(screen.getByRole("img", { name: "Ảnh broken" })).toHaveAttribute(
      "src",
      "https://cdn.test/broken.webp",
    );
    fireEvent.error(screen.getByRole("img", { name: "Ảnh broken" }));
    const fallback = await screen.findByRole("img", {
      name: "Ảnh minh họa hạng phòng CloudStay Suite",
    });
    fireEvent.error(fallback);
    expect(await screen.findByRole("img", { name: "Minh họa phòng CloudStay Suite" })).toBeVisible();
  });

  it("does not send duplicate requests for the same room", async () => {
    mocks.listForRoom.mockResolvedValue({ data: [image("shared")] });
    render(
      <>
        <RoomCardImage room={room} />
        <RoomCardImage room={room} />
      </>,
    );
    expect(await screen.findAllByRole("img", { name: "Ảnh shared" })).toHaveLength(2);
    expect(mocks.listForRoom).toHaveBeenCalledTimes(1);
  });
});
