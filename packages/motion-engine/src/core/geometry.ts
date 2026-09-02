/**
 * Hình học polyline dùng chung (diagram P5: đặt hạt sáng dọc edge, tìm điểm giữa để
 * đặt nhãn). Thuần số học, không phụ thuộc React/Remotion.
 */

export type Pt = { x: number; y: number };

/** Tổng độ dài các đoạn của polyline (px). */
export const polyLength = (pts: Pt[]): number => {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return total;
};

/** Điểm trên polyline theo tham số t∈[0,1] (nội suy theo độ dài đoạn — đều tốc độ). */
export const pointAtPolyline = (pts: Pt[], t: number): Pt => {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  const total = polyLength(pts);
  if (total === 0) return pts[0];
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (d <= len) {
      const f = len === 0 ? 0 : d / len;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * f,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * f,
      };
    }
    d -= len;
  }
  return pts[pts.length - 1];
};

/** Chuỗi điểm → chuỗi "x,y x,y ..." cho points của polyline/polygon SVG. */
export const toPolyPoints = (pts: Pt[]): string =>
  pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
