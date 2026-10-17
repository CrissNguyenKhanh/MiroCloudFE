import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RoomMediaGallery from "./RoomMediaGallery";

const mocks = vi.hoisted(() => ({ listForRoom: vi.fn() }));
vi.mock("../../api", () => ({ api: { media: mocks } }));

const room = {
  id: "room-1",
  name: "CloudStay Suite",
  view: "City",
  palette: ["#79967d", "#e8dfc9", "#173f39"],
};

describe("RoomMediaGallery", () => {
  beforeEach(() => mocks.listForRoom.mockReset());

  it("prioritizes the cover, opens image lightbox and renders video controls", async () => {
    mocks.listForRoom.mockResolvedValue({
      data: [
        { id: "video-1", mediaType: "video", url: "https://cdn.test/tour.webm", thumbnailUrl: "https://cdn.test/tour.jpg", altText: "Room tour", sortOrder: 2, isCover: false },
        { id: "image-1", mediaType: "image", url: "https://cdn.test/cover.webp", altText: "Suite balcony", sortOrder: 5, isCover: true },
      ],
    });
    render(<RoomMediaGallery room={room} />);

    const cover = await screen.findByRole("img", { name: "Suite balcony" });
    expect(cover).toHaveAttribute("src", "https://cdn.test/cover.webp");
    await userEvent.click(screen.getByRole("button", { name: "Xem ảnh kích thước lớn" }));
    expect(screen.getByRole("dialog", { name: "Xem ảnh phòng kích thước lớn" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Đóng ảnh lớn" }));

    await userEvent.click(screen.getByRole("button", { name: "Room tour" }));
    const video = screen.getAllByLabelText("Room tour").find((element) => element.tagName === "VIDEO");
    expect(video).toHaveAttribute("controls");
    expect(video).not.toHaveAttribute("autoplay");
  });

  it("keeps the existing room illustration when backend has no media", async () => {
    mocks.listForRoom.mockResolvedValue({ data: [] });
    render(<RoomMediaGallery room={room} />);
    expect(await screen.findAllByRole("img", { name: /Minh họa phòng CloudStay Suite/ })).toHaveLength(3);
  });
});
