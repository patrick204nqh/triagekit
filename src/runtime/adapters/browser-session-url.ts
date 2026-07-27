import {
  parseSessionQuery,
  serializeSessionQuery,
} from "../session/serialized-session";
import type { SerializedSession } from "../session/types";

export interface SessionUrlAdapter {
  read(): SerializedSession;
  write(state: SerializedSession): void;
}

export function createBrowserSessionUrl(
  browser: Pick<Window, "history" | "location">,
): SessionUrlAdapter {
  return {
    read: () => parseSessionQuery(browser.location.search),
    write(state) {
      const query = serializeSessionQuery(state);
      browser.history.replaceState(
        browser.history.state,
        "",
        `${browser.location.pathname}${query}`,
      );
    },
  };
}
