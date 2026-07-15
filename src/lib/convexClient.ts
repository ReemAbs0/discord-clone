import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL is not set. Run `npx convex dev` once to provision a deployment " +
      "and populate .env.local, then restart the dev server.",
  );
}

export const convex = new ConvexReactClient(convexUrl);
