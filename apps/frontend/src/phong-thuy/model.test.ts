import assert from "node:assert/strict";
import { test } from "node:test";
import { bearing, centroid, DEFAULT_CENTER, destination, directionName, distance, emptyPlan, isSimplePolygon, moveObject, normalizeAngle, objectPoints, parseCoordinates, pathLength, planSchema, polygonArea, rectangle, rectangleFromPoints, sampleObjects, type PlanObject, type Point } from "./model";

const close = (actual: number, expected: number, tolerance = 0.001) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be close to ${expected}`);

test("geographic bearings use north and clockwise degrees, including the north boundary", () => {
  assert.equal(directionName(0), "Bắc"); assert.equal(directionName(359.9), "Bắc");
  assert.equal(directionName(22.49), "Bắc"); assert.equal(directionName(22.5), "Đông Bắc");
  assert.equal(directionName(90), "Đông"); assert.equal(directionName(180), "Nam");
  assert.equal(directionName(270), "Tây"); assert.equal(directionName(-45), "Tây Bắc");
  assert.equal(normalizeAngle(720), 0);
  for (const center of [DEFAULT_CENTER, [21.0285, 105.8542], [-33.86, 151.2]] as Point[]) {
    for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const end = destination(center, 30, angle);
      close(distance(center, end), 30);
      close(Math.min(normalizeAngle(bearing(center, end) - angle), normalizeAngle(angle - bearing(center, end))), 0);
    }
  }
});

test("house edges and area retain meter dimensions across locations and orientations", () => {
  for (const center of [DEFAULT_CENTER, [21.0285, 105.8542], [60, 10]] as Point[]) {
    for (const heading of [0, 37, 90, 135, 270]) {
      const points = rectangle(center, 8, 16, heading);
      close(distance(points[0], points[1]), 8);
      close(distance(points[1], points[2]), 16);
      close(polygonArea(points), 128, 0.01);
      const front = centroid([points[0], points[1]]);
      close(Math.min(normalizeAngle(bearing(center, front) - heading), normalizeAngle(heading - bearing(center, front))), 0, 0.01);
      assert.ok(isSimplePolygon(points));
    }
  }
});

test("moving a whole outline or path preserves segment lengths, shape and orientation", () => {
  const points = rectangle(DEFAULT_CENTER, 8, 16, 125);
  const object: PlanObject = { id: "path", kind: "path", name: "Lối vào", locked: false, points };
  const moved = moveObject(object, destination(DEFAULT_CENTER, 150, 45));
  assert.ok("points" in moved);
  close(pathLength(moved.points), pathLength(points), 0.01);
  close(polygonArea(moved.points), polygonArea(points), 0.01);
  close(bearing(moved.points[0], moved.points[1]), bearing(points[0], points[1]), 0.01);
});

test("freehand houses reject crossing edges and degenerate shapes but accept concave floors", () => {
  const points = rectangle(DEFAULT_CENTER, 8, 16, 0);
  assert.equal(isSimplePolygon([points[0], points[2], points[1], points[3]]), false);
  assert.equal(isSimplePolygon([points[0], points[0], points[1]]), false);
  const local = (east: number, north: number): Point => [DEFAULT_CENTER[0] + north / 111195, DEFAULT_CENTER[1] + east / 109000];
  assert.ok(isSimplePolygon([[0, 0], [2, 0], [2, 1], [3, 1], [3, 0], [5, 0], [5, 4], [0, 4]].map(([e, n]) => local(e, n))));
});

test("plans round-trip and reject malformed imports, duplicate IDs and unsafe coordinates", () => {
  const plan = { ...emptyPlan(), objects: sampleObjects(DEFAULT_CENTER) };
  assert.deepEqual(planSchema.parse(JSON.parse(JSON.stringify(plan))), plan);
  assert.equal(planSchema.safeParse({ ...plan, version: 2 }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, objects: [...plan.objects, plan.objects[0]] }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, center: [90, 0] }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, zoom: Infinity }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, objects: [{ ...plan.objects[0], heading: -1 }] }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, objects: [{ ...plan.objects[0], radius: 0 }] }).success, false);
  const points = rectangle(DEFAULT_CENTER, 8, 16, 0);
  assert.equal(planSchema.safeParse({ ...plan, objects: [{ id: "bad-house", kind: "outline", name: "Nhà", locked: false, points: [points[0], points[2], points[1], points[3]] }] }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, objects: [{ id: "bad-path", kind: "path", name: "Lối vào", locked: false, points: [DEFAULT_CENTER, DEFAULT_CENTER] }] }).success, false);
});

test("coordinate navigation accepts comma or space pairs and rejects incomplete input", () => {
  assert.deepEqual(parseCoordinates("10.77689, 106.70089"), DEFAULT_CENTER);
  assert.deepEqual(parseCoordinates("10.77689 106.70089"), DEFAULT_CENTER);
  assert.deepEqual(parseCoordinates("-33.86; 151.2"), [-33.86, 151.2]);
  for (const value of ["", ",", "10,", ",106", "10", "abc,def", "81,106", "10,181", "10,106,5", "Infinity,10"]) assert.equal(parseCoordinates(value), null, value);
});

test("existing saved drawings gain visible labels and an empty draft without losing objects", () => {
  const current = { ...emptyPlan(), objects: sampleObjects(DEFAULT_CENTER) };
  const { showMapLabels, showDrawingLabels, draft, ...legacy } = current;
  const restored = planSchema.parse({ ...legacy, objects: legacy.objects.map(object => {
    if (object.kind !== "compass") return object;
    const { showOppositeArrow, ...oldCompass } = object;
    return oldCompass;
  }) });
  assert.equal(restored.showMapLabels, true); assert.equal(restored.showDrawingLabels, true);
  assert.deepEqual(restored.draft, { tool: "select", points: [] });
  assert.deepEqual(restored.objects, current.objects);
  assert.equal(restored.objects.find(object => object.kind === "compass")?.showOppositeArrow, false);
});

test("saved workspace retains hidden labels and unfinished geometry across JSON reloads", () => {
  const plan = { ...emptyPlan(), showMapLabels: false, showDrawingLabels: false, objects: sampleObjects(DEFAULT_CENTER), draft: { tool: "outline" as const, points: rectangle(DEFAULT_CENTER, 8, 16, 135).slice(0, 2) } };
  assert.deepEqual(planSchema.parse(JSON.parse(JSON.stringify(plan))), plan);
  plan.objects = plan.objects.map(object => object.kind === "compass" ? { ...object, showOppositeArrow: true } : object);
  assert.deepEqual(planSchema.parse(JSON.parse(JSON.stringify(plan))), plan);
  assert.equal(planSchema.safeParse({ ...plan, draft: { tool: "door", points: plan.draft.points } }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, draft: { tool: "select", points: plan.draft.points } }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, showMapLabels: "false" }).success, false);
});

test("three points form horizontal, vertical and oblique rectangles on either side of the first edge", () => {
  for (const center of [DEFAULT_CENTER, [21.0285, 105.8542], [60, 10]] as Point[]) {
    for (const heading of [0, 90, 45, 127.5, 270]) {
      const corners = rectangle(center, 20, 12, heading);
      for (const third of [corners[2], destination(corners[1], 12, heading)]) {
        const shape = rectangleFromPoints(corners[0], corners[1], third);
        assert.ok(shape);
        close(shape.width, 20); close(shape.depth, 12);
        close(Math.min(normalizeAngle(shape.heading - heading), normalizeAngle(heading - shape.heading)), 0, 0.001);
        const points = rectangle(shape.center, shape.width, shape.depth, shape.heading);
        close(distance(points[0], points[1]), 20); close(distance(points[1], points[2]), 12);
        close(polygonArea(points), 240, 0.01);
        assert.ok(isSimplePolygon(points));
      }
    }
  }
});

test("rectangle drawing rejects zero-width, collinear or excessively large dimensions", () => {
  const a = DEFAULT_CENTER;
  const b = destination(a, 20, 90);
  assert.equal(rectangleFromPoints(a, a, destination(a, 10, 180)), null);
  assert.equal(rectangleFromPoints(a, b, destination(a, 10, 90)), null);
  assert.equal(rectangleFromPoints(a, destination(a, 1001, 90), destination(a, 10, 180)), null);
  assert.equal(rectangleFromPoints(a, b, destination(a, 1001, 180)), null);
});

test("rectangles and their unfinished first edge persist and move without changing dimensions", () => {
  const shape: PlanObject = { id: "rectangle", name: "Phòng xéo", kind: "rectangle", locked: false, center: DEFAULT_CENTER, width: 10, depth: 6, heading: 32.5 };
  const plan = { ...emptyPlan(), objects: [shape], draft: { tool: "rectangle" as const, points: objectPoints(shape).slice(0, 2) } };
  assert.deepEqual(planSchema.parse(JSON.parse(JSON.stringify(plan))), plan);
  const moved = moveObject(shape, destination(DEFAULT_CENTER, 100, 45));
  assert.equal(moved.kind, "rectangle");
  close(polygonArea(objectPoints(moved)), 60, 0.01);
  assert.equal(planSchema.safeParse({ ...plan, draft: { tool: "rectangle", points: objectPoints(shape).slice(0, 3) } }).success, false);
});
