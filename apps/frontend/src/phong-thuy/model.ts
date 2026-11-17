import { z } from "zod";

export type Point = [number, number];
export const EARTH_RADIUS = 6_371_008.8;
const RAD = Math.PI / 180;
export const DEFAULT_CENTER: Point = [10.77689, 106.70089];
export const STORAGE_KEY = "phong-thuy.plan.v1";
export const DIRECTIONS = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
export const DIRECTION_SHORT = ["B", "ĐB", "Đ", "ĐN", "N", "TN", "T", "TB"];
export const normalizeAngle = (value: number) => ((value % 360) + 360) % 360;
export const directionName = (angle: number) => DIRECTIONS[Math.floor((normalizeAngle(angle) + 22.5) / 45) % 8];

export function destination(start: Point, meters: number, angle: number): Point {
  const d = meters / EARTH_RADIUS;
  const a = angle * RAD;
  const lat = start[0] * RAD;
  const lng = start[1] * RAD;
  const nextLat = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(a));
  const nextLng = lng + Math.atan2(Math.sin(a) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(nextLat));
  return [nextLat / RAD, normalizeAngle(nextLng / RAD + 180) - 180];
}

export function distance(a: Point, b: Point): number {
  const dLat = (b[0] - a[0]) * RAD;
  const dLng = (b[1] - a[1]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function bearing(a: Point, b: Point): number {
  const latA = a[0] * RAD;
  const latB = b[0] * RAD;
  const dLng = (b[1] - a[1]) * RAD;
  return normalizeAngle(Math.atan2(Math.sin(dLng) * Math.cos(latB), Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(dLng)) / RAD);
}

export function rectangle(center: Point, width: number, depth: number, heading: number): Point[] {
  return [[-width / 2, depth / 2], [width / 2, depth / 2], [width / 2, -depth / 2], [-width / 2, -depth / 2]].map(([east, north]) => destination(center, Math.hypot(east, north), heading + Math.atan2(east, north) / RAD));
}

export function rectangleFromPoints(first: Point, second: Point, third: Point): { center: Point; width: number; depth: number; heading: number } | null {
  const width = distance(first, second);
  const longitudeScale = Math.cos((first[0] + second[0]) / 2 * RAD);
  const edgeBearing = normalizeAngle(Math.atan2((second[1] - first[1]) * longitudeScale, second[0] - first[0]) / RAD);
  const east = (third[1] - first[1]) * RAD * EARTH_RADIUS * longitudeScale;
  const north = (third[0] - first[0]) * RAD * EARTH_RADIUS;
  const offset = east * Math.cos(edgeBearing * RAD) - north * Math.sin(edgeBearing * RAD);
  const depth = Math.abs(offset);
  if (width < 0.2 || width > 1000 || depth < 0.2 || depth > 1000) return null;
  const middle = destination(first, width / 2, edgeBearing);
  return { center: destination(middle, depth / 2, edgeBearing + (offset >= 0 ? 90 : -90)), width, depth, heading: normalizeAngle(edgeBearing - 90) };
}

export function centroid(points: Point[]): Point {
  return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
}

export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  const origin = points[0];
  const xy = points.map(p => [(p[1] - origin[1]) * RAD * EARTH_RADIUS * Math.cos(origin[0] * RAD), (p[0] - origin[0]) * RAD * EARTH_RADIUS]);
  return Math.abs(xy.reduce((sum, p, i) => { const next = xy[(i + 1) % xy.length]; return sum + p[0] * next[1] - next[0] * p[1]; }, 0)) / 2;
}

export function isSimplePolygon(points: Point[]): boolean {
  if (polygonArea(points) < 0.1) return false;
  const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSegment = (a: Point, b: Point, p: Point) => p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (distance(a, b) < 0.05) return false;
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
      if ((ac * ad < 0 && ca * cb < 0) || (ac === 0 && onSegment(a, b, c)) || (ad === 0 && onSegment(a, b, d)) || (ca === 0 && onSegment(c, d, a)) || (cb === 0 && onSegment(c, d, b))) return false;
    }
  }
  return true;
}

const pointSchema = z.tuple([z.number().finite().min(-80).max(80), z.number().finite().min(-180).max(180)]);
const baseSchema = { id: z.string().min(1).max(100), name: z.string().min(1).max(80), locked: z.boolean() };
const headingSchema = z.number().finite().min(0).lt(360);
const metersSchema = z.number().finite().min(0.2).max(1000);
export const objectSchema = z.discriminatedUnion("kind", [
  z.object({ ...baseSchema, kind: z.literal("compass"), center: pointSchema, radius: z.number().min(2).max(200), heading: headingSchema, opacity: z.number().min(0.15).max(1), showOppositeArrow: z.boolean().default(false) }),
  z.object({ ...baseSchema, kind: z.literal("house"), center: pointSchema, width: metersSchema, depth: metersSchema, heading: headingSchema }),
  z.object({ ...baseSchema, kind: z.literal("rectangle"), center: pointSchema, width: metersSchema, depth: metersSchema, heading: headingSchema }),
  z.object({ ...baseSchema, kind: z.literal("outline"), points: z.array(pointSchema).min(3).max(100) }),
  z.object({ ...baseSchema, kind: z.literal("door"), center: pointSchema, heading: headingSchema, length: metersSchema }),
  z.object({ ...baseSchema, kind: z.literal("kitchen"), center: pointSchema, heading: headingSchema, length: metersSchema }),
  z.object({ ...baseSchema, kind: z.literal("path"), points: z.array(pointSchema).min(2).max(100) }),
]);
export type PlanObject = z.infer<typeof objectSchema>;
export type ObjectKind = PlanObject["kind"];
export type Tool = "select" | ObjectKind;
export const KIND_LABEL: Record<ObjectKind, string> = { compass: "La bàn", house: "Nhà theo kích thước", rectangle: "Hình chữ nhật", outline: "Phác thảo nhà", door: "Cửa chính", kitchen: "Bếp", path: "Lối vào" };
export const KIND_COLOR: Record<ObjectKind, string> = { compass: "#6654b5", house: "#386aa5", rectangle: "#a16c26", outline: "#386aa5", door: "#187a65", kitchen: "#b35e23", path: "#8751a5" };
const draftSchema = z.object({
  tool: z.enum(["select", "compass", "house", "rectangle", "outline", "door", "kitchen", "path"]),
  points: z.array(pointSchema).max(100),
}).superRefine((draft, ctx) => {
  if ((["select", "compass", "house"].includes(draft.tool) && draft.points.length) || (["door", "kitchen"].includes(draft.tool) && draft.points.length > 1) || (draft.tool === "rectangle" && draft.points.length > 2)) ctx.addIssue({ code: "custom", message: "Nét đang vẽ không phù hợp với công cụ" });
});
export const planSchema = z.object({
  version: z.literal(1), title: z.string().min(1).max(100),
  center: pointSchema, zoom: z.number().min(3).max(23), basemap: z.enum(["street", "satellite"]),
  showMapLabels: z.boolean().default(true), showDrawingLabels: z.boolean().default(true),
  draft: draftSchema.default(() => ({ tool: "select" as const, points: [] })),
  objects: z.array(objectSchema).max(300),
}).superRefine((plan, ctx) => {
  if (new Set(plan.objects.map(o => o.id)).size !== plan.objects.length) ctx.addIssue({ code: "custom", message: "ID bị trùng" });
  for (const object of plan.objects) {
    if (object.kind === "outline" && !isSimplePolygon(object.points)) ctx.addIssue({ code: "custom", message: "Các cạnh nhà giao nhau hoặc diện tích không hợp lệ" });
    if (object.kind === "path" && object.points.some((p, i) => i > 0 && distance(p, object.points[i - 1]) < 0.05)) ctx.addIssue({ code: "custom", message: "Lối vào có đoạn quá ngắn" });
  }
});
export type Plan = z.infer<typeof planSchema>;
export const emptyPlan = (): Plan => ({ version: 1, title: "Bản vẽ của tôi", center: DEFAULT_CENTER, zoom: 19, basemap: "street", showMapLabels: true, showDrawingLabels: true, draft: { tool: "select", points: [] }, objects: [] });
export const newId = () => crypto.randomUUID();
export const objectCenter = (object: PlanObject): Point => "center" in object ? object.center : centroid(object.points);
export const objectPoints = (object: PlanObject): Point[] => object.kind === "house" || object.kind === "rectangle" ? rectangle(object.center, object.width, object.depth, object.heading) : "points" in object ? object.points : object.kind === "compass" ? [destination(object.center, object.radius, 0), destination(object.center, object.radius, 90), destination(object.center, object.radius, 180), destination(object.center, object.radius, 270)] : [object.center, destination(object.center, object.length, object.heading)];
export const pathLength = (points: Point[]) => points.reduce((sum, p, i) => sum + (i ? distance(points[i - 1], p) : 0), 0);
export function moveObject(object: PlanObject, next: Point): PlanObject {
  if ("center" in object) return { ...object, center: next };
  const previous = objectCenter(object);
  return { ...object, points: object.points.map(p => destination(next, distance(previous, p), bearing(previous, p))) };
}

export function parseCoordinates(value: string): Point | null {
  const parts = value.trim().split(/[,;\s]+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const parsed = pointSchema.safeParse(parts.map(Number));
  return parsed.success ? parsed.data : null;
}

export function sampleObjects(center: Point): PlanObject[] {
  const front = destination(center, 8, 135);
  return [
    { id: newId(), kind: "compass", name: "La bàn khu đất", locked: false, center, radius: 18, heading: 135, opacity: 0.72, showOppositeArrow: false },
    { id: newId(), kind: "house", name: "Nhà 8 × 16 m", locked: false, center, width: 8, depth: 16, heading: 135 },
    { id: newId(), kind: "door", name: "Cửa chính", locked: false, center: front, heading: 135, length: 4 },
    { id: newId(), kind: "kitchen", name: "Bếp", locked: false, center: destination(center, 5, 320), heading: 45, length: 3 },
    { id: newId(), kind: "path", name: "Lối vào nhà", locked: false, points: [destination(front, 13, 135), destination(front, 8, 135), destination(front, 5, 155), front] },
  ];
}
