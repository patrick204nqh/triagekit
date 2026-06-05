export type Tier = "P0" | "P1" | "P2" | "P3";
export function tierOf(score: number): Tier {
  if (score >= 130) return "P0";
  if (score >= 95) return "P1";
  if (score >= 60) return "P2";
  return "P3";
}
