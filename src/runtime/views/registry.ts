import type { Kind } from "../dataset/item";
export interface ViewModule { id: string; kind: Kind; }
const views = new Map<string, ViewModule>();
export function registerView(v: ViewModule) { views.set(v.id, v); }
export function getView(id: string): ViewModule {
  const v = views.get(id); if (!v) throw new Error(`unknown view: ${id}`); return v;
}
