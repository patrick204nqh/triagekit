import type { ScoredItem } from "./triage-table";
import type { TriageError } from "../ingest/source";

// Provider-keyed runtime context the shell hands to a custom surface.
export interface SurfaceCtx { token: string; }

// A custom list renderer for one artifact. Receives pre-scored rows + non-fatal
// errors, exactly like renderTriageTable, plus the active provider's token.
export type SurfaceRenderer = (root: HTMLElement, rows: ScoredItem[], errors: TriageError[], ctx: SurfaceCtx) => void;

const surfaces = new Map<string, SurfaceRenderer>();
export function registerSurface(artifactId: string, r: SurfaceRenderer): void { surfaces.set(artifactId, r); }
export function resolveSurface(artifactId: string): SurfaceRenderer | undefined { return surfaces.get(artifactId); }
