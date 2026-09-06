import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL auto-cleanup only registers itself when `afterEach` is a global;
// we run vitest with globals:false, so wire it explicitly.
afterEach(() => {
  cleanup();
});
