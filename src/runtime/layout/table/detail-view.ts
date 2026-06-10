import type { Tier } from "../../scoring/tier";

// The shape every kind's detail renderer returns. `body` and `actions` are
// closures created in the same detail() call, so a stateful kind can share one
// state object across both DOM regions the frame mounts them into.
export interface DetailView {
  header: {
    title: string;
    tier: Tier;
    provider: string;                        // → providerIcon(provider)
    ref?: { text: string; href?: string };   // e.g. "#482" linked; omit for kinds with no number
  };
  body: (host: HTMLElement) => void;          // fills the scroll region
  actions?: (host: HTMLElement) => void;      // fills the footer
}
