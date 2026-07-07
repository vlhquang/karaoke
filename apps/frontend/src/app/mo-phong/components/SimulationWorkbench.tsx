"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import {
  ArrowLeft,
  Binoculars,
  Camera,
  Eye,
  EyeOff,
  Globe2,
  Map,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  RotateCcw,
  Search,
  Ship,
  SlidersHorizontal,
  Trash2,
  Waypoints,
  ZoomIn,
} from "lucide-react";
import * as THREE from "three";

const EARTH_TEX =
  "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg";
const SPHERE_CENTER = new THREE.Vector3(-2.8, 0.65, 0);
const PLANE_CENTER = new THREE.Vector3(2.65, -0.82, 0);
const EARTH_RADIUS = 1.55;
const FLAT_EARTH_WIDTH = 5.25;
const FLAT_EARTH_HEIGHT = 2.7;

type ObjectId = "earthSphere" | "earthPlane" | "cargoShip";
type SurfaceKind = "sphere" | "plane";
type ToolMode = "select" | "draw";
type ShipDirection = "drawn" | "reverse" | "leftToRight" | "rightToLeft";

type SceneObjectState = {
  visible: boolean;
  scalePercent: number;
};

type SceneObjects = Record<ObjectId, SceneObjectState>;

type PathPoint = {
  surface: SurfaceKind;
  coordinates: [number, number, number];
};

type ShipMotionState = {
  isMoving: boolean;
  progress: number;
  elapsedMoveSeconds: number;
  pathDurationSeconds: number;
  direction: ShipDirection;
  initialScalePercent: number;
  minScalePercent: number;
  maxScalePercent: number;
  scaleChangePercentPerSecond: number;
  path: PathPoint[];
};

type CameraConfig = {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
};

type BinocularState = {
  active: boolean;
  zoom: number;
};

type LibraryItem = {
  id: ObjectId;
  title: string;
  description: string;
  icon: "globe" | "map" | "ship";
};

type Placement = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

const libraryItems: LibraryItem[] = [
  {
    id: "earthSphere",
    title: "Trái đất hình cầu",
    description: "Bề mặt cong để vẽ hành trình theo cung.",
    icon: "globe",
  },
  {
    id: "cargoShip",
    title: "Tàu chở hàng",
    description: "Phóng to, thu nhỏ, vẽ đường và chạy/dừng.",
    icon: "ship",
  },
  {
    id: "earthPlane",
    title: "Trái đất hình phẳng",
    description: "Mặt phẳng bản đồ để tạo tuyến đơn giản.",
    icon: "map",
  },
];

const formatPercent = (value: number) => `${Math.round(value)}%`;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getScaleFactor(percent: number) {
  return percent / 100;
}

function getShipScalePercent(ship: ShipMotionState) {
  return clamp(
    ship.initialScalePercent + ship.elapsedMoveSeconds * ship.scaleChangePercentPerSecond,
    ship.minScalePercent,
    ship.maxScalePercent,
  );
}

function resolvePathPoint(point: PathPoint, objects: SceneObjects) {
  if (point.surface === "sphere") {
    const sphereScale = getScaleFactor(objects.earthSphere.scalePercent);
    const normal = new THREE.Vector3(...point.coordinates).normalize();
    return SPHERE_CENTER.clone().add(normal.multiplyScalar(EARTH_RADIUS * sphereScale + 0.08));
  }

  const planeScale = getScaleFactor(objects.earthPlane.scalePercent);
  return PLANE_CENTER.clone().add(new THREE.Vector3(point.coordinates[0] * planeScale, 0.08, point.coordinates[2] * planeScale));
}

function getOrderedPath(path: PathPoint[], direction: ShipDirection, objects: SceneObjects) {
  const points = [...path];

  if (direction === "reverse") {
    return points.reverse();
  }

  if (direction === "leftToRight" || direction === "rightToLeft") {
    points.sort((a, b) => resolvePathPoint(a, objects).x - resolvePathPoint(b, objects).x);
    return direction === "rightToLeft" ? points.reverse() : points;
  }

  return points;
}

function getPlacementAtProgress(path: PathPoint[], progress: number, direction: ShipDirection, objects: SceneObjects): Placement {
  const orderedPath = getOrderedPath(path, direction, objects);

  if (orderedPath.length < 2) {
    return {
      position: new THREE.Vector3(0.25, -0.28, 1.35),
      quaternion: new THREE.Quaternion(),
    };
  }

  const clampedProgress = clamp(progress, 0, 1);
  const segmentProgress = clampedProgress * (orderedPath.length - 1);
  const segmentIndex = Math.min(Math.floor(segmentProgress), orderedPath.length - 2);
  const localProgress = segmentProgress - segmentIndex;
  const from = orderedPath[segmentIndex];
  const to = orderedPath[segmentIndex + 1];
  const fromPosition = resolvePathPoint(from, objects);
  const toPosition = resolvePathPoint(to, objects);
  const tangent = toPosition.clone().sub(fromPosition).normalize();
  let position = fromPosition.clone().lerp(toPosition, localProgress);
  let up = new THREE.Vector3(0, 1, 0);

  if (from.surface === "sphere" && to.surface === "sphere") {
    const sphereScale = getScaleFactor(objects.earthSphere.scalePercent);
    const centerOffset = position.clone().sub(SPHERE_CENTER).normalize();
    position = SPHERE_CENTER.clone().add(centerOffset.clone().multiplyScalar(EARTH_RADIUS * sphereScale + 0.17));
    up = centerOffset;
  }

  const forward = tangent.projectOnPlane(up).normalize();
  const safeForward = forward.lengthSq() > 0.0001 ? forward : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(up, safeForward).normalize();
  const basis = new THREE.Matrix4().makeBasis(safeForward, up, side);

  return {
    position,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(basis),
  };
}

function IconForItem({ icon }: { icon: LibraryItem["icon"] }) {
  if (icon === "globe") {
    return <Globe2 className="h-5 w-5" />;
  }

  if (icon === "ship") {
    return <Ship className="h-5 w-5" />;
  }

  return <Map className="h-5 w-5" />;
}

export default function SimulationWorkbench() {
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedObject, setSelectedObject] = useState<ObjectId>("cargoShip");
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [objects, setObjects] = useState<SceneObjects>({
    earthSphere: { visible: true, scalePercent: 100 },
    earthPlane: { visible: true, scalePercent: 100 },
    cargoShip: { visible: true, scalePercent: 100 },
  });
  const [ship, setShip] = useState<ShipMotionState>({
    isMoving: false,
    progress: 0,
    elapsedMoveSeconds: 0,
    pathDurationSeconds: 18,
    direction: "drawn",
    initialScalePercent: 100,
    minScalePercent: 15,
    maxScalePercent: 240,
    scaleChangePercentPerSecond: -1,
    path: [],
  });
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    x: 0,
    y: 5.7,
    z: 8.6,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
  });
  const [binoculars, setBinoculars] = useState<BinocularState>({
    active: false,
    zoom: 2.2,
  });

  const filteredItems = useMemo(() => {
    const normalized = searchText.trim().toLocaleLowerCase("vi-VN");

    if (!normalized) {
      return libraryItems;
    }

    return libraryItems.filter((item) =>
      `${item.title} ${item.description}`.toLocaleLowerCase("vi-VN").includes(normalized),
    );
  }, [searchText]);

  const currentShipScalePercent = getShipScalePercent(ship);
  const canMoveShip = ship.path.length >= 2 && objects.cargoShip.visible;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncLayout = () => setIsCompactLayout(mediaQuery.matches);

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);

    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    if (!ship.isMoving) {
      return;
    }

    let frameId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;

      setShip((previous) => {
        if (!previous.isMoving) {
          return previous;
        }

        const pathDuration = Math.max(previous.pathDurationSeconds, 1);
        const nextProgress = clamp(previous.progress + deltaSeconds / pathDuration, 0, 1);

        return {
          ...previous,
          progress: nextProgress,
          elapsedMoveSeconds: previous.elapsedMoveSeconds + deltaSeconds,
          isMoving: nextProgress < 1,
        };
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [ship.isMoving]);

  const updateObject = (id: ObjectId, updates: Partial<SceneObjectState>) => {
    setObjects((previous) => ({
      ...previous,
      [id]: {
        ...previous[id],
        ...updates,
      },
    }));
  };

  const updateShip = (updates: Partial<ShipMotionState>) => {
    setShip((previous) => ({
      ...previous,
      ...updates,
    }));
  };

  const addPathPoint = (point: PathPoint) => {
    setSelectedObject("cargoShip");
    setShip((previous) => {
      const shouldRestartPath = previous.path.length > 0 && previous.path[0].surface !== point.surface;

      return {
        ...previous,
        isMoving: false,
        progress: shouldRestartPath ? 0 : previous.progress,
        elapsedMoveSeconds: shouldRestartPath ? 0 : previous.elapsedMoveSeconds,
        path: shouldRestartPath ? [point] : [...previous.path, point],
      };
    });
  };

  const toggleShipMovement = () => {
    if (!canMoveShip) {
      return;
    }

    setShip((previous) => ({
      ...previous,
      isMoving: !previous.isMoving,
      progress: previous.progress >= 1 ? 0 : previous.progress,
      elapsedMoveSeconds: previous.progress >= 1 ? 0 : previous.elapsedMoveSeconds,
    }));
  };

  const resetShipJourney = () => {
    setShip((previous) => ({
      ...previous,
      isMoving: false,
      progress: 0,
      elapsedMoveSeconds: 0,
    }));
  };

  const clearShipPath = () => {
    setShip((previous) => ({
      ...previous,
      isMoving: false,
      progress: 0,
      elapsedMoveSeconds: 0,
      path: [],
    }));
  };

  const applyCameraPreset = (preset: "overview" | "sphere" | "plane" | "ship") => {
    if (preset === "sphere") {
      setCameraConfig({ x: -5.4, y: 3.3, z: 4.2, targetX: SPHERE_CENTER.x, targetY: SPHERE_CENTER.y, targetZ: 0 });
      return;
    }

    if (preset === "plane") {
      setCameraConfig({ x: 2.65, y: 4.4, z: 3.7, targetX: PLANE_CENTER.x, targetY: PLANE_CENTER.y, targetZ: 0 });
      return;
    }

    if (preset === "ship") {
      const placement = getPlacementAtProgress(ship.path, ship.progress, ship.direction, objects);
      setCameraConfig({
        x: placement.position.x + 2.3,
        y: placement.position.y + 1.8,
        z: placement.position.z + 2.8,
        targetX: placement.position.x,
        targetY: placement.position.y,
        targetZ: placement.position.z,
      });
      return;
    }

    setCameraConfig({ x: 0, y: 5.7, z: 8.6, targetX: 0, targetY: 0, targetZ: 0 });
  };

  return (
    <main className="h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        className="grid h-full transition-[grid-template-columns] duration-300"
        style={{
          gridTemplateColumns: isCompactLayout || !isLibraryOpen
            ? "minmax(0, 1fr)"
            : "minmax(300px, 30%) minmax(0, 1fr)",
        }}
      >
        {isCompactLayout && isLibraryOpen && (
          <button
            type="button"
            aria-label="Đóng thư viện"
            onClick={() => setIsLibraryOpen(false)}
            className="absolute inset-0 z-30 bg-black/50"
          />
        )}
        <aside
          style={isLibraryOpen ? undefined : { opacity: 0, transform: "translateX(-100%)" }}
          className={`h-full overflow-hidden border-r border-zinc-800 bg-zinc-950/95 transition duration-200 ${
            isCompactLayout
              ? `absolute inset-y-0 left-0 z-40 w-[min(340px,88vw)] shadow-2xl shadow-black/50 ${isLibraryOpen ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-full opacity-0"}`
              : isLibraryOpen
                ? "opacity-100"
                : "pointer-events-none absolute inset-y-0 left-0 z-40 w-[300px] -translate-x-full opacity-0"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-cyan-500 hover:text-cyan-200" title="Trang chủ">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Workbench</p>
                  <h1 className="truncate text-xl font-semibold text-zinc-50">Mô phỏng</h1>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-cyan-500 hover:text-cyan-200"
                  title="Ẩn thư viện"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Tìm vật thể"
                  className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-200">Vật thể</h2>
                  <span className="text-xs text-zinc-500">{filteredItems.length}</span>
                </div>
                <div className="space-y-2">
                  {filteredItems.map((item) => {
                    const isSelected = selectedObject === item.id;
                    const isVisible = objects[item.id].visible;

                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedObject(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedObject(item.id);
                          }
                        }}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition ${
                          isSelected
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-50"
                            : "border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:border-zinc-600"
                        }`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isSelected ? "bg-cyan-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>
                          <IconForItem icon={item.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="mt-0.5 block line-clamp-2 text-xs text-zinc-500">{item.description}</span>
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            updateObject(item.id, { visible: !isVisible });
                          }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-200"
                          title={isVisible ? "Ẩn vật thể" : "Hiện vật thể"}
                        >
                          {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="mt-5 border-t border-zinc-800 pt-4">
                <ObjectSettings
                  selectedObject={selectedObject}
                  objects={objects}
                  ship={ship}
                  currentShipScalePercent={currentShipScalePercent}
                  canMoveShip={canMoveShip}
                  updateObject={updateObject}
                  updateShip={updateShip}
                  toggleShipMovement={toggleShipMovement}
                  resetShipJourney={resetShipJourney}
                  clearShipPath={clearShipPath}
                  toolMode={toolMode}
                  setToolMode={setToolMode}
                />
              </section>
            </div>
          </div>
        </aside>

        <section className="relative min-w-0 overflow-hidden bg-[#10100f]">
          <SimulationCanvas
            objects={objects}
            ship={ship}
            toolMode={toolMode}
            binoculars={binoculars}
            cameraConfig={cameraConfig}
            selectedObject={selectedObject}
            setSelectedObject={setSelectedObject}
            addPathPoint={addPathPoint}
            shipScalePercent={currentShipScalePercent}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
            <div className="pointer-events-auto flex items-center gap-2">
              {!isLibraryOpen && (
                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950/85 text-zinc-200 shadow-lg shadow-black/30 backdrop-blur hover:border-cyan-500 hover:text-cyan-200"
                  title="Hiện thư viện"
                >
                  <PanelLeftOpen className="h-5 w-5" />
                </button>
              )}
              <ToolButton
                active={toolMode === "select"}
                label="Chọn"
                onClick={() => setToolMode("select")}
                icon={<MousePointer2 className="h-4 w-4" />}
              />
              <ToolButton
                active={toolMode === "draw"}
                label="Vẽ đường tàu"
                onClick={() => {
                  setSelectedObject("cargoShip");
                  setToolMode("draw");
                }}
                icon={<Waypoints className="h-4 w-4" />}
              />
              <ToolButton
                active={binoculars.active}
                label="Ống nhòm"
                onClick={() => setBinoculars((previous) => ({ ...previous, active: !previous.active }))}
                icon={<Binoculars className="h-4 w-4" />}
              />
            </div>

            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{ship.path.length} điểm đường</span>
              <span className="text-zinc-600">/</span>
              <span>{formatPercent(currentShipScalePercent)}</span>
            </div>
          </div>

          <CameraControlPanel cameraConfig={cameraConfig} setCameraConfig={setCameraConfig} applyCameraPreset={applyCameraPreset} />

          {binoculars.active && (
            <div className="pointer-events-none absolute inset-0 z-30">
              <div className="absolute inset-0 border-[min(12vw,120px)] border-black/45" />
              <div className="absolute left-1/2 top-1/2 h-[58vh] w-[74vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-zinc-200/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]" />
              <div className="pointer-events-auto absolute bottom-5 left-1/2 flex w-[min(560px,88vw)] -translate-x-1/2 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950/90 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur">
                <ZoomIn className="h-5 w-5 text-amber-300" />
                <input
                  value={binoculars.zoom}
                  onChange={(event) => setBinoculars((previous) => ({ ...previous, zoom: Number(event.target.value) }))}
                  type="range"
                  min={1}
                  max={6}
                  step={0.1}
                  className="w-full accent-amber-400"
                />
                <span className="w-12 text-right text-sm font-medium text-zinc-100">{binoculars.zoom.toFixed(1)}x</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ToolButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border shadow-lg shadow-black/25 backdrop-blur transition ${
        active
          ? "border-amber-300 bg-amber-300 text-zinc-950"
          : "border-zinc-700 bg-zinc-950/85 text-zinc-200 hover:border-cyan-500 hover:text-cyan-200"
      }`}
      title={label}
    >
      {icon}
    </button>
  );
}

function ObjectSettings({
  selectedObject,
  objects,
  ship,
  currentShipScalePercent,
  canMoveShip,
  updateObject,
  updateShip,
  toggleShipMovement,
  resetShipJourney,
  clearShipPath,
  toolMode,
  setToolMode,
}: {
  selectedObject: ObjectId;
  objects: SceneObjects;
  ship: ShipMotionState;
  currentShipScalePercent: number;
  canMoveShip: boolean;
  updateObject: (id: ObjectId, updates: Partial<SceneObjectState>) => void;
  updateShip: (updates: Partial<ShipMotionState>) => void;
  toggleShipMovement: () => void;
  resetShipJourney: () => void;
  clearShipPath: () => void;
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
}) {
  if (selectedObject !== "cargoShip") {
    const title = selectedObject === "earthSphere" ? "Trái đất hình cầu" : "Trái đất hình phẳng";

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          <button
            type="button"
            onClick={() => updateObject(selectedObject, { visible: !objects[selectedObject].visible })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-200"
            title={objects[selectedObject].visible ? "Ẩn vật thể" : "Hiện vật thể"}
          >
            {objects[selectedObject].visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        <RangeField
          label="Kích thước"
          value={objects[selectedObject].scalePercent}
          min={40}
          max={220}
          step={1}
          suffix="%"
          onChange={(value) => updateObject(selectedObject, { scalePercent: value })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Tàu chở hàng</h2>
        <button
          type="button"
          onClick={() => updateObject("cargoShip", { visible: !objects.cargoShip.visible })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-200"
          title={objects.cargoShip.visible ? "Ẩn tàu" : "Hiện tàu"}
        >
          {objects.cargoShip.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={toggleShipMovement}
          disabled={!canMoveShip}
          className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-500/60 bg-emerald-500/10 text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
          title={ship.isMoving ? "Dừng tàu" : "Chạy tàu"}
        >
          {ship.isMoving ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={resetShipJourney}
          className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-cyan-500 hover:text-cyan-200"
          title="Về đầu hành trình"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={clearShipPath}
          className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-red-400 hover:text-red-200"
          title="Xóa đường"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setToolMode(toolMode === "draw" ? "select" : "draw")}
        className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm transition ${
          toolMode === "draw"
            ? "border-amber-300 bg-amber-300 text-zinc-950"
            : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-cyan-500"
        }`}
      >
        <Waypoints className="h-4 w-4" />
        Vẽ đường di chuyển
      </button>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
        <Metric label="Thời gian" value={`${ship.elapsedMoveSeconds.toFixed(1)}s`} />
        <Metric label="Kích thước" value={formatPercent(currentShipScalePercent)} />
        <Metric label="Tiến trình" value={`${Math.round(ship.progress * 100)}%`} />
        <Metric label="Số điểm" value={String(ship.path.length)} />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-400">Hướng di chuyển</span>
        <select
          value={ship.direction}
          onChange={(event) => updateShip({ direction: event.target.value as ShipDirection, isMoving: false, progress: 0, elapsedMoveSeconds: 0 })}
          className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-500"
        >
          <option value="drawn">Theo thứ tự vẽ</option>
          <option value="reverse">Ngược thứ tự vẽ</option>
          <option value="leftToRight">Trái qua phải</option>
          <option value="rightToLeft">Phải qua trái</option>
        </select>
      </label>

      <RangeField
        label="Thời gian đi hết đường"
        value={ship.pathDurationSeconds}
        min={3}
        max={90}
        step={1}
        suffix="s"
        onChange={(value) => updateShip({ pathDurationSeconds: value })}
      />

      <RangeField
        label="Kích thước ban đầu"
        value={ship.initialScalePercent}
        min={10}
        max={300}
        step={1}
        suffix="%"
        onChange={(value) => updateShip({ initialScalePercent: value })}
      />

      <NumberField
        label="Thay đổi mỗi giây"
        value={ship.scaleChangePercentPerSecond}
        min={-20}
        max={20}
        step={0.5}
        suffix="%/s"
        onChange={(value) => updateShip({ scaleChangePercentPerSecond: value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Nhỏ nhất"
          value={ship.minScalePercent}
          min={1}
          max={ship.maxScalePercent}
          step={1}
          suffix="%"
          onChange={(value) => updateShip({ minScalePercent: value })}
        />
        <NumberField
          label="Lớn nhất"
          value={ship.maxScalePercent}
          min={ship.minScalePercent}
          max={500}
          step={1}
          suffix="%"
          onChange={(value) => updateShip({ maxScalePercent: value })}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-zinc-400">
        <span>{label}</span>
        <span className="text-zinc-100">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan-400"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>
      <div className="flex h-9 items-center rounded-md border border-zinc-700 bg-zinc-900 px-2 focus-within:border-cyan-500">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none"
        />
        <span className="text-xs text-zinc-500">{suffix}</span>
      </div>
    </label>
  );
}

function CameraControlPanel({
  cameraConfig,
  setCameraConfig,
  applyCameraPreset,
}: {
  cameraConfig: CameraConfig;
  setCameraConfig: Dispatch<SetStateAction<CameraConfig>>;
  applyCameraPreset: (preset: "overview" | "sphere" | "plane" | "ship") => void;
}) {
  const update = (key: keyof CameraConfig, value: number) => {
    setCameraConfig((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 w-[min(360px,calc(100%-2rem))] rounded-lg border border-zinc-700 bg-zinc-950/86 p-3 shadow-xl shadow-black/35 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <Camera className="h-4 w-4 text-cyan-300" />
          Góc nhìn
        </div>
        <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {[
          ["overview", "Tổng"],
          ["sphere", "Cầu"],
          ["plane", "Phẳng"],
          ["ship", "Tàu"],
        ].map(([preset, label]) => (
          <button
            type="button"
            key={preset}
            onClick={() => applyCameraPreset(preset as "overview" | "sphere" | "plane" | "ship")}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 text-xs text-zinc-200 hover:border-cyan-500 hover:text-cyan-100"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniNumber label="X" value={cameraConfig.x} min={-12} max={12} step={0.1} onChange={(value) => update("x", value)} />
        <MiniNumber label="Cao" value={cameraConfig.y} min={0.5} max={12} step={0.1} onChange={(value) => update("y", value)} />
        <MiniNumber label="Z" value={cameraConfig.z} min={-12} max={12} step={0.1} onChange={(value) => update("z", value)} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <MiniNumber label="Nhìn X" value={cameraConfig.targetX} min={-8} max={8} step={0.1} onChange={(value) => update("targetX", value)} />
        <MiniNumber label="Nhìn Y" value={cameraConfig.targetY} min={-4} max={6} step={0.1} onChange={(value) => update("targetY", value)} />
        <MiniNumber label="Nhìn Z" value={cameraConfig.targetZ} min={-8} max={8} step={0.1} onChange={(value) => update("targetZ", value)} />
      </div>
    </div>
  );
}

function MiniNumber({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <input
        type="number"
        value={Number(value.toFixed(1))}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
        className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
      />
    </label>
  );
}

function SimulationCanvas({
  objects,
  ship,
  toolMode,
  binoculars,
  cameraConfig,
  selectedObject,
  setSelectedObject,
  addPathPoint,
  shipScalePercent,
}: {
  objects: SceneObjects;
  ship: ShipMotionState;
  toolMode: ToolMode;
  binoculars: BinocularState;
  cameraConfig: CameraConfig;
  selectedObject: ObjectId;
  setSelectedObject: (id: ObjectId) => void;
  addPathPoint: (point: PathPoint) => void;
  shipScalePercent: number;
}) {
  return (
    <Canvas shadows dpr={[1, 1.7]} className="h-full w-full">
      <color attach="background" args={["#10100f"]} />
      <fog attach="fog" args={["#10100f", 9, 22]} />
      <PerspectiveCamera makeDefault position={[cameraConfig.x, cameraConfig.y, cameraConfig.z]} fov={50} near={0.05} far={120} />
      <CameraRig cameraConfig={cameraConfig} binoculars={binoculars} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-3, 7, 5]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[3, 3, -4]} intensity={12} color="#fed7aa" />
      <Stars radius={80} depth={32} count={1800} factor={3} saturation={0.3} fade speed={0.35} />
      <Suspense fallback={null}>
        <SimulationScene
          objects={objects}
          ship={ship}
          toolMode={toolMode}
          selectedObject={selectedObject}
          setSelectedObject={setSelectedObject}
          addPathPoint={addPathPoint}
          shipScalePercent={shipScalePercent}
        />
      </Suspense>
    </Canvas>
  );
}

function CameraRig({ cameraConfig, binoculars }: { cameraConfig: CameraConfig; binoculars: BinocularState }) {
  const { camera } = useThree();
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);

  useEffect(() => {
    camera.position.set(cameraConfig.x, cameraConfig.y, cameraConfig.z);

    if (controlsRef.current) {
      controlsRef.current.target.set(cameraConfig.targetX, cameraConfig.targetY, cameraConfig.targetZ);
      controlsRef.current.update();
    } else {
      camera.lookAt(cameraConfig.targetX, cameraConfig.targetY, cameraConfig.targetZ);
    }
  }, [camera, cameraConfig, controlsRef]);

  useEffect(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    perspectiveCamera.fov = binoculars.active ? clamp(50 / binoculars.zoom, 8, 50) : 50;
    perspectiveCamera.updateProjectionMatrix();
  }, [binoculars.active, binoculars.zoom, camera]);

  return (
    <OrbitControls
      ref={(instance) => {
        controlsRef.current = instance;
      }}
      makeDefault
      enablePan
      enableRotate
      enableZoom
      minDistance={1.5}
      maxDistance={25}
      target={[cameraConfig.targetX, cameraConfig.targetY, cameraConfig.targetZ]}
    />
  );
}

function SimulationScene({
  objects,
  ship,
  toolMode,
  selectedObject,
  setSelectedObject,
  addPathPoint,
  shipScalePercent,
}: {
  objects: SceneObjects;
  ship: ShipMotionState;
  toolMode: ToolMode;
  selectedObject: ObjectId;
  setSelectedObject: (id: ObjectId) => void;
  addPathPoint: (point: PathPoint) => void;
  shipScalePercent: number;
}) {
  const pathPoints = useMemo(() => getOrderedPath(ship.path, ship.direction, objects).map((point) => resolvePathPoint(point, objects)), [objects, ship.direction, ship.path]);
  const shipPlacement = useMemo(() => getPlacementAtProgress(ship.path, ship.progress, ship.direction, objects), [objects, ship.direction, ship.path, ship.progress]);
  const earthMap = useLoader(THREE.TextureLoader, EARTH_TEX);

  const handleSpherePointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();

    if (toolMode === "draw") {
      const normal = event.point.clone().sub(SPHERE_CENTER).normalize();
      addPathPoint({ surface: "sphere", coordinates: normal.toArray() as [number, number, number] });
      return;
    }

    setSelectedObject("earthSphere");
  };

  const handlePlanePointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();

    if (toolMode === "draw") {
      const planeScale = getScaleFactor(objects.earthPlane.scalePercent);
      const local = event.point.clone().sub(PLANE_CENTER).divideScalar(planeScale);
      addPathPoint({ surface: "plane", coordinates: [local.x, 0, local.z] });
      return;
    }

    setSelectedObject("earthPlane");
  };

  const selectShip = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setSelectedObject("cargoShip");
  };

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.22, 0]}>
        <planeGeometry args={[16, 11]} />
        <meshStandardMaterial color="#171611" roughness={0.82} metalness={0.05} />
      </mesh>

      <gridHelper args={[16, 32, "#3f3f46", "#27272a"]} position={[0, -1.2, 0]} />

      {objects.earthSphere.visible && (
        <group position={SPHERE_CENTER} scale={getScaleFactor(objects.earthSphere.scalePercent)}>
          <mesh castShadow receiveShadow onPointerDown={handleSpherePointer}>
            <sphereGeometry args={[EARTH_RADIUS, 80, 80]} />
            <meshStandardMaterial map={earthMap} roughness={0.88} metalness={0.02} />
          </mesh>
          <mesh scale={1.018}>
            <sphereGeometry args={[EARTH_RADIUS, 80, 80]} />
            <meshStandardMaterial color="#7dd3fc" transparent opacity={0.14} roughness={0.2} metalness={0.1} />
          </mesh>
          {selectedObject === "earthSphere" && (
            <mesh scale={1.045}>
              <sphereGeometry args={[EARTH_RADIUS, 48, 48]} />
              <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} wireframe />
            </mesh>
          )}
        </group>
      )}

      {objects.earthPlane.visible && (
        <group position={PLANE_CENTER} scale={getScaleFactor(objects.earthPlane.scalePercent)}>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} onPointerDown={handlePlanePointer}>
            <planeGeometry args={[FLAT_EARTH_WIDTH, FLAT_EARTH_HEIGHT, 96, 48]} />
            <meshStandardMaterial map={earthMap} roughness={0.9} metalness={0.02} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
            <ringGeometry args={[1.98, 2.02, 96]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={selectedObject === "earthPlane" ? 0.55 : 0.22} />
          </mesh>
        </group>
      )}

      {pathPoints.length >= 2 && <Line points={pathPoints} color="#fbbf24" lineWidth={3} dashed={false} />}
      {pathPoints.map((point, index) => (
        <mesh key={`${point.x}-${point.y}-${point.z}-${index}`} position={point}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color={index === 0 ? "#22c55e" : index === pathPoints.length - 1 ? "#ef4444" : "#fbbf24"} />
        </mesh>
      ))}

      {objects.cargoShip.visible && (
        <CargoShipObject
          placement={shipPlacement}
          scalePercent={shipScalePercent}
          selected={selectedObject === "cargoShip"}
          isMoving={ship.isMoving}
          onPointerDown={selectShip}
        />
      )}
    </group>
  );
}

function CargoShipObject({
  placement,
  scalePercent,
  selected,
  isMoving,
  onPointerDown,
}: {
  placement: Placement;
  scalePercent: number;
  selected: boolean;
  isMoving: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const groupRef = useRef<THREE.Group | null>(null);

  useFrame((_, delta) => {
    if (groupRef.current && isMoving) {
      groupRef.current.position.y += Math.sin(performance.now() * 0.006) * delta * 0.015;
    }
  });

  const scale = getScaleFactor(scalePercent) * 0.56;

  return (
    <group ref={groupRef} position={placement.position} quaternion={placement.quaternion} scale={scale} onPointerDown={onPointerDown}>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[1.75, 0.28, 0.48]} />
        <meshStandardMaterial color="#164e63" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.82, 0.12, 0]}>
        <coneGeometry args={[0.28, 0.34, 4]} />
        <meshStandardMaterial color="#0e7490" roughness={0.5} metalness={0.12} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.52, 0.36, 0]}>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.45} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.88, 0.24, 0]}>
        <boxGeometry args={[0.22, 0.66, 0.28]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.45} />
      </mesh>
      {[
        [-0.1, 0.32, -0.16, "#ef4444"],
        [0.18, 0.32, -0.16, "#f97316"],
        [0.46, 0.32, -0.16, "#84cc16"],
        [-0.1, 0.32, 0.16, "#38bdf8"],
        [0.18, 0.32, 0.16, "#a78bfa"],
        [0.46, 0.32, 0.16, "#f59e0b"],
      ].map(([x, y, z, color]) => (
        <mesh key={`${x}-${z}`} castShadow receiveShadow position={[Number(x), Number(y), Number(z)]}>
          <boxGeometry args={[0.25, 0.2, 0.24]} />
          <meshStandardMaterial color={String(color)} roughness={0.72} />
        </mesh>
      ))}
      {selected && (
        <mesh position={[0, 0.03, 0]} scale={[1.2, 0.2, 0.58]}>
          <boxGeometry args={[1.9, 1.9, 1.9]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.13} wireframe />
        </mesh>
      )}
    </group>
  );
}
