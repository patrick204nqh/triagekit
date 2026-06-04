export interface ViewModule {
  id: string;
  needs: ("alerts")[];               // provider capabilities required
  mount(root: HTMLElement, ctx: ViewContext): void;
}
export interface ViewContext {
  org: string; repos: string[]; token: () => string | null;
  score: (a: import("../providers/registry").Alert) => number;
}
const views = new Map<string, ViewModule>();
export function registerView(v: ViewModule) { views.set(v.id, v); }
export function getView(id: string) {
  const v = views.get(id);
  if (!v) throw new Error(`unknown view: ${id}`);
  return v;
}
