/** Bounded light pool: a walking observer takes priority over remote rooms. */
export function observerRoom(rooms: any[], position: number[] | null, selected: string) {
  if (selected !== "all") return selected;
  if (!position) return null;
  const inside = (polygon: number[][]) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a[1] > position[2]) !== (b[1] > position[2]) &&
          position[0] < (b[0] - a[0]) * (position[2] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  };
  // Hall intentionally overlaps the living polygon in the inherited model.
  return rooms.filter(r => r.id !== "hall").find(r => inside(r.polygon))?.id ??
    rooms.find(r => r.id === "hall" && inside(r.polygon))?.id ?? null;
}

export function allocateLighting<T extends { f: any; score: number }>(
  candidates: T[], slots: number, localRoom: string | null, mobile: boolean,
): T[] {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const chosen: T[] = [];
  const counts = new Map<string, number>();
  const add = (f: T) => {
    if (chosen.length >= slots || chosen.includes(f)) return;
    chosen.push(f); counts.set(f.f.roomId, (counts.get(f.f.roomId) ?? 0) + 1);
  };
  if (localRoom) {
    const local = ranked.filter(f => f.f.roomId === localRoom);
    // Keep a useful task source before decorative wash where it is enabled.
    const task = local.find(f => ["task", "work", "reading"].includes(f.f.group));
    if (task) add(task);
    for (const source of local) {
      if ((counts.get(localRoom) ?? 0) >= (mobile ? 3 : 4)) break;
      add(source);
    }
  }
  ranked.forEach(f => { if (!counts.has(f.f.roomId)) add(f); });
  ranked.forEach(f => {
    const cap = f.f.roomId === localRoom ? (mobile ? 3 : 4) : 2;
    if ((counts.get(f.f.roomId) ?? 0) < cap) add(f);
  });
  return chosen;
}
