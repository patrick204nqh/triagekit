import { configDefaults, defineConfig } from "vitest/config";

export const testExclude = [
  ...configDefaults.exclude,
  "**/.worktrees/**",
];

export default defineConfig({
  test: {
    exclude: testExclude,
    environment: "jsdom",
  },
});
