import { convexTest } from "convex-test";
import schema from "../../convex/schema";

// Shared convex-test harness (T006). Glob-loads every convex/*.ts module so
// convex-test can simulate queries/mutations against an in-memory backend
// without a live Convex deployment. Import `makeConvexTest()` from backend
// unit tests in this directory (e.g. presence.test.ts, servers.test.ts).
const modules = import.meta.glob("../../convex/**/*.ts");

export function makeConvexTest() {
  return convexTest(schema, modules);
}
