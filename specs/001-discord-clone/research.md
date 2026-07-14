# Phase 0 Research: Discord Clone

All technology choices were specified directly by the user (see plan.md Technical Context), so no
`NEEDS CLARIFICATION` markers remain from that section. This document records the concrete patterns and
rationale needed to implement that stack correctly and in line with the constitution.

> **Verification pass (2026-07-14)**: Sections 1, 2, 3, 4, and 6 were re-checked against current official
> documentation (docs.convex.dev, labs.convex.dev/auth, MDN, the WebRTC W3C spec) because library/spec
> APIs move faster than this document's original draft. Each updated section below cites its source and
> notes anything that changed versus the original draft. Package versions are pinned to what was current
> on the verification date; re-check before implementation if significant time has passed.

## 1. Convex Auth with the Password provider

**Decision**: Use `@convex-dev/auth@0.0.94` (peer deps: `@auth/core@0.41.1`, `convex@^1.17.0`) with the
Password provider for signup/login.

**Exact setup** (verified against labs.convex.dev/auth/setup/manual):

- `convex/auth.config.ts`:
  ```ts
  export default {
    providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: "convex" }],
  };
  ```
- `convex/auth.ts`:
  ```ts
  import { Password } from "@convex-dev/auth/providers/Password";
  import { convexAuth } from "@convex-dev/auth/server";

  export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
    providers: [Password],
  });
  ```
- `convex/http.ts` — **still required** even though we only use Password (no OAuth), because Convex
  Auth's HTTP callback routes are wired through it:
  ```ts
  import { httpRouter } from "convex/server";
  import { auth } from "./auth";

  const http = httpRouter();
  auth.addHttpRoutes(http);
  export default http;
  ```
- `convex/schema.ts` spreads `authTables` from `@convex-dev/auth/server`, and we **extend the `users`
  table inline** (documented pattern) rather than keeping a separate `profiles` table, to add our own
  fields alongside the ones Convex Auth already defines (`name`, `image`, `email`, etc.):
  ```ts
  import { defineSchema, defineTable } from "convex/server";
  import { v } from "convex/values";
  import { authTables } from "@convex-dev/auth/server";

  export default defineSchema({
    ...authTables,
    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      phone: v.optional(v.string()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      avatarStorageId: v.optional(v.id("_storage")), // our addition
    }).index("email", ["email"]),
    // ...our other tables (data-model.md)
  });
  ```
  This **replaces** data-model.md's original framing of a fully separate `User` profile table — the
  profile fields live directly on the auth-owned `users` table. `data-model.md` should be read with this
  update in mind (see note there).
- Frontend: wrap the app in `ConvexAuthProvider` (from `@convex-dev/auth/react`), **not** plain
  `ConvexProvider`:
  ```tsx
  import { ConvexAuthProvider } from "@convex-dev/auth/react";
  import { ConvexReactClient } from "convex/react";

  const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <ConvexAuthProvider client={convex}><App /></ConvexAuthProvider>,
  );
  ```
- Sign in/up/out: `const { signIn, signOut } = useAuthActions()` (from `@convex-dev/auth/react`).
  `signIn("password", { email, password, flow: "signUp" | "signIn", name })` — the Password provider
  distinguishes sign-up vs sign-in via the `flow` field in the params object.
- Auth state in components: `useConvexAuth()` — lives in **core `convex/react`**, not
  `@convex-dev/auth/react` (easy to mis-cite). Current shape has **three** fields, not two:
  `{ isLoading, isAuthenticated, isRefreshing }` — `isRefreshing` is new since the original draft of this
  doc and indicates a stale token is being silently replaced; worth showing a subtle "reconnecting" state
  for, not a full loading spinner.
- Resolving the caller inside a query/mutation: **prefer `getAuthUserId(ctx)` from
  `@convex-dev/auth/server`** over raw `ctx.auth.getUserIdentity()` — it returns `Id<"users"> | null`
  directly, typed against our own `users` table, and is what `convex/lib/authz.ts`'s helpers should call
  internally.

**Status flag**: Convex Auth is explicitly documented as **beta** ("may change in backward-incompatible
ways"). A newer official alternative, `@convex-dev/better-auth` (wrapping the third-party Better Auth
library), now also exists as a Convex Component; there is no deprecation notice against `@convex-dev/auth`
in favor of it as of this check. Given this project is Vite + React (not Next.js) and needs nothing
beyond email/password, `@convex-dev/auth` remains the simpler, docs-endorsed fit — Better Auth is noted
here as a future option if broader OAuth/framework support is ever needed, not a reason to switch now.

**Rationale**: Matches the spec's clarified decision (email + password as the unique login credential,
display name separate and non-unique) and the constitution's Security Basics principle — auth state is
resolved server-side on every call, never trusted from the client. It also avoids hand-rolling session/
password-hashing code, which would violate Simplicity First.

**Alternatives considered**: A custom `users` table with hand-rolled password hashing (rejected — reinvents
what Convex Auth already provides, and is a security foot-gun for a non-negotiable principle); Clerk/Auth0
(rejected — external dependency/cost not requested); `@convex-dev/better-auth` (noted above — viable but
unnecessary added surface for a Password-only v1).

## 2. Real-time presence & typing indicators without polling

**Decision**: Presence and typing are heartbeat-*written*, subscription-*read*:
- The client calls a `presence.heartbeat` / `typingIndicators.heartbeat` **mutation** every few seconds
  while a tab is open / a user is actively typing, upserting a row keyed by user (and, for typing, by
  channel) with `lastActiveAt: now`.
- Every other client reads presence/typing purely via `useQuery` — a live subscription. It never re-fetches
  on a timer.
- A Convex **cron job** (`convex/crons.ts`) runs every ~10–15s and deletes presence/typing rows whose
  `lastActiveAt` is older than a threshold (e.g., 30s for presence, 5s for typing). That delete is a
  write, so it pushes an immediate reactive update to every subscriber — the "went offline" / "stopped
  typing" transition is delivered the same way a message is: via subscription push, not client polling.

**Rationale**: This satisfies Real-Time Correctness (no manual polling of *read* state) while still
handling staleness, which pure subscriptions can't detect on their own (a client that vanishes without
closing cleanly never sends a final "offline" write). The heartbeat write cadence is normal duty-cycle
behavior for any presence system (Discord itself works this way), not a workaround.

**Alternative found during verification, not adopted**: Convex now publishes an official
`@convex-dev/presence` Component (heartbeat + stale-cleanup + scoped "rooms," hook from
`@convex-dev/presence/react`) that implements essentially this same pattern out of the box. It was not
in scope when the user's plan input listed `typingIndicators`/`presence` as tables to hand-roll, so this
plan keeps the custom-table design to match that explicit instruction and to keep full control over the
per-channel typing scope (the component is presence-oriented; typing-per-channel would still likely need
a custom table alongside it). **Flagging this for the user/team**: adopting `@convex-dev/presence` for
the presence half specifically could remove `presence.ts` and its cron sweep entirely — worth a deliberate
yes/no decision before `/speckit-tasks`, not something this document silently decides.

**Other alternatives considered and rejected**: Client-side `setInterval` polling of a query's result
(exactly the polling the constitution forbids); a "last write wins, never expires" row with no cron sweep
(a user who closes their laptop lid would appear online forever).

## 3. WebRTC signaling over a Convex table, using the Perfect Negotiation pattern

**Decision**: A `signals` table holds one row per SDP offer/answer or ICE candidate, addressed by
`callId` + `toUserId`. The recipient subscribes via `useQuery(api.signals.listForMe, { callId })`
(indexed by `(callId, toUserId)`), processes any new row through the matching `RTCPeerConnection`, and
calls a `signals.ack` mutation to delete it once consumed, keeping the table small.

**Negotiation pattern (verified current against MDN, "Perfect negotiation," updated 2025-05-27)**: each
pairwise `RTCPeerConnection` in the mesh runs the current MDN-recommended perfect-negotiation state
machine, transported over the `signals` table instead of a raw WebSocket:

```javascript
// one of these per remote peer in the mesh, keyed by remote user ID
let makingOffer = false;
let ignoreOffer = false;
let isSettingRemoteAnswerPending = false;
const polite = myUserId > remoteUserId; // deterministic per-pair, needs no extra round-trip

pc.onnegotiationneeded = async () => {
  try {
    makingOffer = true;
    await pc.setLocalDescription(); // no-arg: auto-detects offer vs answer, current standard since 2017
    await sendSignal({ type: "description", description: pc.localDescription });
  } finally {
    makingOffer = false;
  }
};

// on receiving a signals row addressed to me from this remote peer:
async function onSignal({ description, candidate }) {
  if (description) {
    const readyForOffer = !makingOffer && (pc.signalingState === "stable" || isSettingRemoteAnswerPending);
    const offerCollision = description.type === "offer" && !readyForOffer;
    ignoreOffer = !polite && offerCollision;
    if (ignoreOffer) return;

    isSettingRemoteAnswerPending = description.type === "answer";
    await pc.setRemoteDescription(description); // implicitly rolls back our own pending offer if we're polite
    isSettingRemoteAnswerPending = false;
    if (description.type === "offer") {
      await pc.setLocalDescription();
      await sendSignal({ type: "description", description: pc.localDescription });
    }
  } else if (candidate) {
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (!ignoreOffer) throw err;
    }
  }
}
```

Notes worth preserving from verification (not obvious from older/cached knowledge of this pattern):
- There is **no explicit rollback call** — `setRemoteDescription()` on a colliding offer implicitly rolls
  back the polite peer's own pending local offer. Don't implement a manual `{type: "rollback"}` call.
- Politeness must be **decided independently and identically by both sides without an extra signaling
  round-trip** — comparing user IDs (`myUserId > remoteUserId`) is simpler than "first to connect" for a
  mesh, since every pairwise connection needs its own polite/impolite flag and state
  (`makingOffer`/`ignoreOffer`/`isSettingRemoteAnswerPending`), tracked per remote peer, not globally.
- MDN's guide only covers 1:1 connections; extending one independent state machine per peer connection in
  the mesh is this project's extrapolation, not an MDN-sourced claim.

**Rationale**: Directly replaces the Socket.io server the user explicitly said to avoid — Convex's
reactive queries are a sufficient transport for the low-volume, bursty signaling traffic a mesh call of
≤4 participants produces, and the perfect-negotiation pattern is the current standard way to avoid glare
between simultaneous offers without a central negotiation authority.

**Alternatives considered**: A dedicated WebSocket signaling server (rejected — exactly the extra service
the user asked to eliminate); an SFU-based topology (LiveKit/mediasoup) for cleaner scaling past 4
participants (rejected — explicitly out of scope; full-mesh is acceptable and simpler at this scale);
naive "always the joiner offers" negotiation without glare handling (rejected — breaks as soon as two
peers both trigger renegotiation at once, e.g. both toggling camera simultaneously).

## 4. Connection recovery: ICE restart

**Decision**: Watch `pc.connectionState` via the `connectionstatechange` event as the primary signal for
call health (it aggregates ICE + DTLS state, Baseline since May 2023), and call `pc.restartIce()` — the
current no-arg standard method (Baseline since April 2021, supersedes the older
`createOffer({iceRestart: true})` pattern) — when it reaches `"failed"`. Treat `"disconnected"` as a
transient/recoverable state to debounce for a few seconds before escalating, since brief network blips can
self-resolve. `iceconnectionstatechange`/`pc.iceConnectionState` is kept only as a secondary, ICE-only
diagnostic signal.

```javascript
pc.addEventListener("connectionstatechange", () => {
  if (pc.connectionState === "failed") {
    pc.restartIce(); // triggers onnegotiationneeded; flows through the perfect-negotiation handler above
  }
});
```

Calling `restartIce()` causes the *next* `onnegotiationneeded`-triggered offer to carry the ICE restart —
it integrates directly with the negotiation handler in §3 above rather than needing separate offer/answer
code.

**Rationale**: Directly addresses the spec's edge case "What happens when a user loses network
connectivity mid-call?" — a peer connection that goes into `"failed"` triggers an automatic ICE restart
attempt before the app gives up and shows the participant as disconnected, rather than requiring a full
call rejoin for every transient network hiccup.

**Alternatives considered**: Tearing down and recreating the whole `RTCPeerConnection` on any disconnect
(rejected — heavier-handed than necessary; `restartIce()` reuses the existing connection and media state);
no reconnection handling at all (rejected — fails the edge case requirement outright).

## 5. STUN-only NAT traversal (no TURN)

**Decision**: Use only Google's public STUN server (`stun:stun.l.google.com:19302`) in the
`RTCPeerConnection` ICE configuration:
```javascript
new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
```
No TURN relay is provisioned.

**Verification note**: no official deprecation of Google's public STUN server was found as of this check
— it remains active and commonly referenced in current (2025-dated) third-party documentation. However,
it has **never been an official, SLA-backed public product** (it's infrastructure Google runs for its own
services like Meet/Hangouts that happens to be open) — that caveat is longstanding, not a new risk. If
call reliability ever needs hardening beyond v1, Cloudflare's (`stun:stun.cloudflare.com:3478`) or
Twilio's (`stun:global.stun.twilio.com:3478`) STUN servers are the commonly-cited, more explicitly
published alternatives — noted here, not adopted now, to keep v1 as simple as specified.

**Rationale**: Matches the user's explicit instruction. STUN alone is sufficient for the common case
(most home/office NATs), and adding a TURN server means either running relay infrastructure or paying
for a hosted one — both against Simplicity First for a v1.

**Consequence to document, not fix**: Participants behind symmetric/strict NAT (common on some corporate
or carrier-grade NAT networks) may be unable to establish a direct peer connection and will see the call
fail to connect. This is called out in quickstart.md as a known limitation, and the UI should surface a
clear "call failed to connect" state (no silent hang) rather than attempt to work around it.

## 6. Message pagination (newest-first, infinite scroll)

**Decision**: Use Convex's built-in cursor pagination on an index ordered by `_creationTime` descending,
scoped to `channelId` (or `directMessageThreadId`).

**Verified exact API** (`convex@1.42.1`, docs.convex.dev/database/pagination):
- Backend: `paginationOptsValidator` from `convex/server`, combined with `.paginate(paginationOpts)`:
  ```ts
  import { paginationOptsValidator } from "convex/server";
  export const list = query({
    args: { channelId: v.id("channels"), paginationOpts: paginationOptsValidator },
    handler: (ctx, { channelId, paginationOpts }) =>
      ctx.db.query("messages").withIndex("by_channel_and_creation", q => q.eq("channelId", channelId))
        .order("desc").paginate(paginationOpts),
  });
  ```
- Frontend: `usePaginatedQuery(api.messages.list, { channelId }, { initialNumItems: 25 })` returns
  `{ results, status, isLoading, loadMore }`, where `status` is exactly one of
  `"LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"` and `loadMore(numItems: number): void`
  requests the next page (call it when the member scrolls to the top of the loaded list, i.e. toward
  older history).
- For optimistically inserting a just-sent message at the correct end of a paginated list, Convex ships
  built-in helpers for this exact case: `insertAtTop` / `insertAtBottomIfLoaded` / `insertAtPosition`,
  used with `useMutation(...).withOptimisticUpdate(...)`. For this app's newest-first ordering, sending a
  message should use `insertAtTop` so it appears immediately without waiting for the round-trip.

**Rationale**: Convex's paginated queries are still reactive — new messages arriving at the top of the
list show up live without disturbing the older, already-loaded pages — satisfying both FR-020 (newest-
first, progressively-older history) and Real-Time Correctness at once. The optimistic-insert helper keeps
the sender's own message feeling instant without extra hand-written cache-patching code.

**Alternatives considered**: Offset-based pagination (rejected — Convex doesn't support it natively and
it's unstable under concurrent inserts); loading all messages at once (rejected — violates FR-020 and
would not scale even for a student project once a channel has real history); hand-written optimistic
cache patching via `localStore.setQuery` (rejected in favor of the built-in paginated-list helpers, which
do the same thing with less code — Simplicity First).

## 7. Testing approach (Testable Seams)

**Decision**:
- **Vitest + React Testing Library** for frontend unit/component tests, targeting logic in
  `src/features/*` (non-UI hooks) kept separate from `src/components/*` (presentation).
- **`convex-test`** for unit-testing `convex/*.ts` query/mutation logic (authorization checks, invite
  consumption, membership limits, call-capacity enforcement) without a live deployment.
- **Playwright** for exactly the two smoke tests the constitution names as the minimum bar: send a
  message and see it appear in another session (`tests/e2e/send-message.spec.ts`), and join a voice
  channel call as two participants (`tests/e2e/join-call.spec.ts`).

**Rationale**: Directly satisfies Constitution Principle VI (Testable Seams) — logic testable without
rendering, plus the two named critical-flow smoke tests — without imposing full TDD ceremony on every
change (matching the constitution's stated non-goal).

**Alternatives considered**: Cypress instead of Playwright (either would satisfy the constitution;
Playwright chosen for first-class multi-context support, needed to simulate two simultaneous browser
sessions for real-time and call testing). Jest instead of Vitest (rejected — Vitest is the natural fit
for a Vite project, avoiding a second build-tool config).

## 8. Avatar / server image storage

**Decision**: Use Convex file storage (`ctx.storage.generateUploadUrl` / `ctx.storage.getUrl`) for user
avatars and server images. The `users` table's `avatarStorageId` field (see §1) and the `servers` table
store a storage ID / resolved URL, not raw bytes.

**Rationale**: Keeps binary storage inside the same backend (Convex) rather than introducing a separate
object-storage dependency (e.g., S3), consistent with Simplicity First and the single-repo/single-backend
structure decision.

**Alternatives considered**: A third-party storage/CDN service (rejected — unnecessary dependency for
v1 scale); storing images as base64 in a document field (rejected — Convex document size limits and poor
read performance for something better served by dedicated file storage).
