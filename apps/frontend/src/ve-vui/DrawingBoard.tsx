"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import type { Point, Stroke } from "./types";
import { BOARD_WIDTH } from "./fill";

export function paintStrokes(canvas: HTMLCanvasElement, strokes: Stroke[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, 1000, 650);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 1000, 650);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.fill) {
      context.fillStyle = stroke.color;
      for (let i = 0; i < stroke.fill.length; i += 2) {
        const start = stroke.fill[i];
        context.fillRect(start % BOARD_WIDTH, Math.floor(start / BOARD_WIDTH), stroke.fill[i + 1], 1);
      }
      continue;
    }
    if (!stroke.points.length) continue;
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    if (stroke.points.length === 1) {
      context.beginPath();
      context.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, 2 * Math.PI);
      context.fill();
    }
  }
}

export function DrawingBoard({ strokes, enabled, color, width, onStroke, onFill, filling = false, label = "Bảng vẽ trực tiếp" }: {
  strokes: Stroke[]; enabled: boolean; color: string; width: number;
  onStroke: (stroke: Stroke) => void; onFill?: (point: Point) => void; filling?: boolean; label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = useRef<{ id: string; pointerId: number; color: string; width: number; points: Point[]; last: Point } | null>(null);
  const lastFlush = useRef(0);
  const sendRef = useRef(onStroke);
  sendRef.current = onStroke;
  useEffect(() => { if (canvasRef.current) paintStrokes(canvasRef.current, strokes); }, [strokes]);
  useEffect(() => { if (!enabled) active.current = null; }, [enabled]);
  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1000, (event.clientX - rect.left) / rect.width * 1000)), y: Math.max(0, Math.min(650, (event.clientY - rect.top) / rect.height * 650)) };
  };
  const flush = () => {
    if (!active.current?.points.length) return;
    const stroke = active.current;
    const points = stroke.points.splice(0, 60);
    sendRef.current({ id: stroke.id, color: stroke.color, width: stroke.width, points });
    lastFlush.current = performance.now();
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || (event.pointerType === "mouse" && event.button !== 0) || (event.pointerType === "touch" && !event.isPrimary) || active.current) return;
    if (filling && onFill) { onFill(point(event)); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    const first = point(event);
    active.current = { id: crypto.randomUUID(), pointerId: event.pointerId, color, width, points: [first], last: first };
    flush();
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const stroke = active.current;
    if (!stroke || !enabled || stroke.pointerId !== event.pointerId) return;
    const next = point(event);
    if (Math.hypot(next.x - stroke.last.x, next.y - stroke.last.y) < 1) return;
    // Include the previous point to bridge chunks on remote canvases.
    if (!stroke.points.length) stroke.points.push(stroke.last);
    stroke.points.push(next);
    const context = canvasRef.current?.getContext("2d");
    if (context) {
      context.strokeStyle = stroke.color; context.lineWidth = stroke.width; context.lineCap = "round";
      context.beginPath(); context.moveTo(stroke.last.x, stroke.last.y); context.lineTo(next.x, next.y); context.stroke();
    }
    stroke.last = next;
    if (performance.now() - lastFlush.current >= 40 || stroke.points.length >= 60) flush();
  };
  const stop = (event: PointerEvent<HTMLCanvasElement>) => {
    if (active.current?.pointerId !== event.pointerId) return;
    flush(); active.current = null;
  };
  return <canvas ref={canvasRef} width={1000} height={650} className={`vv-canvas${enabled ? " is-drawing" : ""}`} aria-label={label} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onContextMenu={event => event.preventDefault()} />;
}
