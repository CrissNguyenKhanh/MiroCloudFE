import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  search: vi.fn(),
  listForRoom: vi.fn(),
}));

vi.mock("../api", () => ({
  api: {
    rooms: { list: mocks.list, search: mocks.search },
    media: { listForRoom: mocks.listForRoom },
  },
  isMockMode: false,
}));

import { clearRoomMediaCache } from "../api/mediaCache";
import HomePage from "./HomePage";
import SearchPage from "./SearchPage";

function room(id, { featured = true } = {}) {
  return {
    id,
    roomNumber: id,
    name: `Room ${id}`,
    type: "deluxe",
    pricePerNight: 1_500_000,
    capacity: 2,
    size: 34,
    bed: "1 giường King",
    amenities: ["Wi-Fi", "Bữa sáng"],
    featured,
  };
}

function mediaFor(roomId) {
  return {
    data: [
      {
        id: `media-${roomId}`,
        mediaType: "image",
        url: `https://cdn.test/${roomId}.webp`,
        altText: `Cover ${roomId}`,
        sortOrder: 1,
        isCover: true,
      },
    ],
  };
}

describe("room listing media", () => {
  beforeEach(() => {
    clearRoomMediaCache();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listForRoom.mockImplementation(async (roomId) => mediaFor(roomId));
  });

  it("loads real media only for featured rooms rendered on the home page", async () => {
    mocks.list.mockResolvedValue({
      data: [
        room("featured-a"),
        room("not-featured", { featured: false }),
        room("featured-b"),
      ],
    });
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("img", { name: "Cover featured-a" })).toBeVisible();
    expect(await screen.findByRole("img", { name: "Cover featured-b" })).toBeVisible();
    expect(mocks.listForRoom).toHaveBeenCalledTimes(2);
    expect(mocks.listForRoom).not.toHaveBeenCalledWith("not-featured");
  });

  it("loads media for the new room IDs when search pagination changes", async () => {
    mocks.search.mockImplementation(async ({ page }) => ({
      data: [room(page === 2 ? "page-two" : "page-one")],
      meta: { page, limit: 9, total: 10 },
    }));
    render(
      <MemoryRouter initialEntries={["/rooms?page=1"]}>
        <SearchPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("img", { name: "Cover page-one" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Trang sau/ }));
    expect(await screen.findByRole("img", { name: "Cover page-two" })).toBeVisible();

    await waitFor(() => expect(mocks.listForRoom).toHaveBeenCalledTimes(2));
    expect(mocks.listForRoom.mock.calls.map(([id]) => id)).toEqual([
      "page-one",
      "page-two",
    ]);
  });
});
