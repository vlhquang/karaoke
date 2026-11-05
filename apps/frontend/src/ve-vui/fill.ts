export const BOARD_WIDTH = 1000;
export const BOARD_HEIGHT = 650;
export const MAX_CANVAS_COST = 35000;

export function validFillRuns(runs: number[], width = BOARD_WIDTH, height = BOARD_HEIGHT): boolean {
  if (!runs.length || runs.length % 2 || runs.length > MAX_CANVAS_COST * 2) return false;
  let end = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const start = runs[i], length = runs[i + 1];
    if (!Number.isInteger(start) || !Number.isInteger(length) || start < end || length < 1 || start + length > width * height || Math.floor(start / width) !== Math.floor((start + length - 1) / width)) return false;
    end = start + length;
  }
  return true;
}

/** Non-recursive, bounded flood fill; the source pixels are never mutated. */
export function floodFillRuns(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: string, tolerance = 32): number[] {
  if (data.length !== width * height * 4 || !Number.isFinite(x) || !Number.isFinite(y)) return [];
  x = Math.max(0, Math.min(width - 1, Math.floor(x))); y = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const seed = y * width + x, index = seed * 4;
  const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  if (rgb.some(Number.isNaN) || (rgb.every((value, c) => value === data[index + c]) && data[index + 3] === 255)) return [];
  const target = data.slice(index, index + 4);
  const visited = new Uint8Array(width * height), mask = new Uint8Array(width * height), queue = new Uint32Array(width * height);
  let head = 0, tail = 1; queue[0] = seed; visited[seed] = 1;
  const visit = (pixel: number) => { if (!visited[pixel]) { visited[pixel] = 1; queue[tail++] = pixel; } };
  while (head < tail) {
    const pixel = queue[head++], p = pixel * 4;
    if (Math.max(Math.abs(target[0] - data[p]), Math.abs(target[1] - data[p + 1]), Math.abs(target[2] - data[p + 2]), Math.abs(target[3] - data[p + 3])) > tolerance) continue;
    mask[pixel] = 1;
    if (pixel % width) visit(pixel - 1);
    if (pixel % width !== width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < width * (height - 1)) visit(pixel + width);
  }
  const runs: number[] = [];
  for (let row = 0; row < height; row++) {
    const limit = (row + 1) * width;
    for (let p = row * width; p < limit;) {
      if (!mask[p]) { p++; continue; }
      const start = p; while (p < limit && mask[p]) p++;
      runs.push(start, p - start);
      if (runs.length > MAX_CANVAS_COST * 2) throw new Error("Vùng tô quá phức tạp. Thử một vùng nhỏ hơn nhé.");
    }
  }
  return runs;
}
