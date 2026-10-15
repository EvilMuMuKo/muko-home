import { storageCapacity, upperStorage } from "./storage-design";
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
) {
  const list = document.querySelector("#storage-list")!;
  const report = storageCapacity();
  document.querySelector("#storage-summary")!.textContent =
    `${upperStorage.length} 组上部柜体 · 封闭约 ${(report.closedLitres / 1000).toFixed(1)} m³ · 展示约 ${(report.displayLitres / 1000).toFixed(1)} m³`;
  for (const [room, name] of Object.entries(roomNames)) {
    const units = report.units.filter((u) => u.room === room),
      card = document.createElement("article");
    card.className = "storage-card";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `查看${name}`;
    button.dataset.storageRoom = room;
    button.onclick = () => onView(reviewPoints[room]);
    card.append(button);
    const capacity = document.createElement("p");
    capacity.textContent = `封闭 ${Math.round(units.reduce((s, u) => s + u.closedLitres, 0))} L · 展示 ${Math.round(units.reduce((s, u) => s + u.displayLitres, 0))} L`;
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
