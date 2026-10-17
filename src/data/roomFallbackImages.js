import cloudstaySuite from "../assets/rooms/cloudstay-suite.jpg";
import deluxeSkyline from "../assets/rooms/deluxe-skyline.jpg";
import executiveRiver from "../assets/rooms/executive-river.jpg";
import familyHaven from "../assets/rooms/family-haven.jpg";
import premierGarden from "../assets/rooms/premier-garden.jpg";
import twinComfort from "../assets/rooms/twin-comfort.jpg";

const byType = {
  deluxe: deluxeSkyline,
  premier: premierGarden,
  family: familyHaven,
  executive: executiveRiver,
  suite: cloudstaySuite,
  twin: twinComfort,
};

const byName = {
  "cloudstay suite": cloudstaySuite,
  "deluxe skyline": deluxeSkyline,
  "executive river": executiveRiver,
  "family haven": familyHaven,
  "premier garden": premierGarden,
  "twin comfort": twinComfort,
};

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function getRoomFallbackImage(room) {
  const source = byName[normalized(room?.name)] ?? byType[normalized(room?.type)];
  if (!source) return null;
  return {
    src: source,
    alt: `Ảnh minh họa hạng phòng ${room?.name ?? "CloudStay"}`,
  };
}
