export type Transform =
  | { type: "linear"; in: [number, number] }
  | { type: "bool" }
  | { type: "enum"; map: Record<string, number> }
  | { type: "ageDays"; halfLife: number };

// Normalize a raw field value to 0..1. Total: any bad input yields 0, never throws.
export function applyTransform(raw: unknown, tf: Transform, now: number = Date.now()): number {
  switch (tf.type) {
    case "linear": {
      const [lo, hi] = tf.in;
      const v = Number(raw);
      if (!Number.isFinite(v) || hi === lo) return 0;
      return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    }
    case "bool":
      return raw ? 1 : 0;
    case "enum":
      return tf.map[String(raw)] ?? 0;
    case "ageDays": {
      const t = +new Date(raw as string);
      if (!Number.isFinite(t) || tf.halfLife <= 0) return 0;
      const days = Math.max(0, (now - t) / 86400000);
      return 1 - Math.pow(2, -days / tf.halfLife);
    }
  }
}
