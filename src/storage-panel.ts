import {
  storageCapacity,
  upperStorage,
  type StorageUnit,
} from "./storage-design";
const roomNames: Record<string, string> = {
  kitchen: "厨房",
  bar: "水吧与餐厅",
  master: "主卧",
  guest: "影音室 · 兼客房",
  living: "客厅",
  hall: "玄关",
  bath: "卫浴",
  balcony: "生活阳台",
};
const reviewPoints: Record<string, string> = {
  kitchen: "kitchen-upper-review",
  bar: "bar-upper-review",
  master: "master-upper-review",
  guest: "guest-upper-review",
  living: "living-upper-review",
  hall: "hall-storage-review",
  bath: "bath-upper-review",
  balcony: "laundry-upper-review",
};
export function mountStoragePanel(
  onView: (id: string) => void,
  onOpen: () => void,
  actualUnits: StorageUnit[] = upperStorage,
) {
  const list = document.querySelector("#storage-list")!;
  const report = storageCapacity(actualUnits);
  document.querySelector("#storage-summary")!.textContent =
    "随手取用，妥帖收藏。";
  for (const [room, name] of Object.entries(roomNames)) {
    const units = report.units.filter((u) => u.room === room);
    if (!units.length) continue;
    const card = document.createElement("article");
    card.className = "storage-card";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `查看${name}`;
    button.dataset.storageRoom = room;
    button.onclick = () => onView(reviewPoints[room]);
    card.append(button);
    const capacity = document.createElement("p");
    capacity.textContent = units.some((u) => u.access === "seasonal")
      ? "日常与季节收纳"
      : "日常收纳";
    card.append(capacity);
    const text = document.createElement("p");
    text.textContent = units
      .map(
        (u) =>
          `${u.label}：${u.purpose}${u.access === "seasonal" ? "（高位低频）" : ""}`,
      )
      .join("；");
    card.append(text);
    list.append(card);
  }
  document.querySelector("#storage-doors")!.addEventListener("click", onOpen);
}
