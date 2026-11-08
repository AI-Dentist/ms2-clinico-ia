/**
 * YOLO11 ONNX output decoder and Non-Maximum Suppression (NMS).
 *
 * Expected model output tensor: float32[1, 4+numClasses, numAnchors]
 *   - Rows 0-3: cx, cy, w, h in pixel coords (0..inputSize range, e.g. 0..640)
 *   - Rows 4+:  per-class confidence scores (after sigmoid, 0..1)
 *
 * Letterbox context is required to map boxes back to the original image space.
 */

export interface LetterboxContext {
  origWidth: number;
  origHeight: number;
  scale: number;
  padLeft: number;
  padTop: number;
  inputSize: number; // e.g. 640
}

export interface RawDetection {
  classIdx: number;
  score: number;
  /** Bounding box in original-image pixel space */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface NormalizedDetection {
  classIdx: number;
  score: number;
  /** Bounding box normalized to [0, 1] relative to original image */
  x: number;
  y: number;
  width: number;
  height: number;
}

function iou(a: NormalizedDetection, b: NormalizedDetection): number {
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;

  const iLeft = Math.max(a.x, b.x);
  const iTop = Math.max(a.y, b.y);
  const iRight = Math.min(aRight, bRight);
  const iBottom = Math.min(aBottom, bBottom);

  if (iRight <= iLeft || iBottom <= iTop) return 0;

  const interArea = (iRight - iLeft) * (iBottom - iTop);
  const aArea = a.width * a.height;
  const bArea = b.width * b.height;

  return interArea / (aArea + bArea - interArea);
}

export function nms(detections: NormalizedDetection[], iouThreshold: number): NormalizedDetection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const result: NormalizedDetection[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    result.push(sorted[i]!);
    for (let j = i + 1; j < sorted.length; j++) {
      if (!suppressed.has(j) && iou(sorted[i]!, sorted[j]!) > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return result;
}

/**
 * Decode YOLO11 raw output into normalized bounding boxes for the original image.
 *
 * @param outputData  Float32Array from ONNX session, shape [4+numClasses, numAnchors] (flattened row-major)
 * @param numAnchors  Total anchor count (e.g. 8400 for 640-input YOLO11-N)
 * @param numClasses  Number of detection classes (e.g. 3)
 * @param ctx         Letterbox context from preprocessing
 * @param confThreshold  Minimum class score to keep (e.g. 0.45)
 * @param iouThreshold   IoU threshold for NMS suppression (e.g. 0.35)
 */
export function decodeYolo11Output(
  outputData: Float32Array,
  numAnchors: number,
  numClasses: number,
  ctx: LetterboxContext,
  confThreshold: number,
  iouThreshold: number,
): NormalizedDetection[] {
  const candidates: NormalizedDetection[] = [];

  for (let a = 0; a < numAnchors; a++) {
    let maxScore = 0;
    let classIdx = 0;

    for (let c = 0; c < numClasses; c++) {
      const score = outputData[(4 + c) * numAnchors + a] ?? 0;
      if (score > maxScore) {
        maxScore = score;
        classIdx = c;
      }
    }

    if (maxScore < confThreshold) continue;

    // cx, cy, w, h — YOLO11 ONNX exports these in pixel space [0..inputSize]
    const rawCx = outputData[a] ?? 0;
    const rawCy = outputData[1 * numAnchors + a] ?? 0;
    const rawW = outputData[2 * numAnchors + a] ?? 0;
    const rawH = outputData[3 * numAnchors + a] ?? 0;

    // If the model exported normalized [0,1] coords instead, scale up
    const cx = rawCx > 1 ? rawCx : rawCx * ctx.inputSize;
    const cy = rawCy > 1 ? rawCy : rawCy * ctx.inputSize;
    const bw = rawW > 1 ? rawW : rawW * ctx.inputSize;
    const bh = rawH > 1 ? rawH : rawH * ctx.inputSize;

    // Convert from center format to corner format in letterboxed pixel space
    const x1Pad = cx - bw / 2;
    const y1Pad = cy - bh / 2;
    const x2Pad = cx + bw / 2;
    const y2Pad = cy + bh / 2;

    // Undo letterbox padding and scale to original image pixel space
    const x1Orig = (x1Pad - ctx.padLeft) / ctx.scale;
    const y1Orig = (y1Pad - ctx.padTop) / ctx.scale;
    const x2Orig = (x2Pad - ctx.padLeft) / ctx.scale;
    const y2Orig = (y2Pad - ctx.padTop) / ctx.scale;

    // Clamp to image bounds
    const x1 = Math.max(0, x1Orig);
    const y1 = Math.max(0, y1Orig);
    const x2 = Math.min(ctx.origWidth, x2Orig);
    const y2 = Math.min(ctx.origHeight, y2Orig);

    if (x2 <= x1 || y2 <= y1) continue;

    // Normalize to [0, 1]
    candidates.push({
      classIdx,
      score: maxScore,
      x: x1 / ctx.origWidth,
      y: y1 / ctx.origHeight,
      width: (x2 - x1) / ctx.origWidth,
      height: (y2 - y1) / ctx.origHeight,
    });
  }

  return nms(candidates, iouThreshold);
}
