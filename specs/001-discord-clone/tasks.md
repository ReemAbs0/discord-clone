# Tasks: Discord Clone — Real-Time Chat & Video Platform

**Input**: Design documents from `/specs/001-discord-clone/` (spec.md, plan.md, research.md, data-model.md, contracts/convex-api.md, quickstart.md)

**Tests**: Not full TDD — the constitution's Testable Seams principle requires exactly two end-to-end
smoke tests by name (send a message, join a call) plus business logic kept testable via `convex-test`
(backend) and Vitest (frontend non-UI hooks). Those specific tasks are called out inline; this is not a
write-tests-first-for-every-endpoint approach.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) so each story is an
independently testable, demoable increment, per the constitution's Incremental Delivery principle.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no same-phase dependency)
- **[Story]**: Maps the task to spec.md's US1–US8
- File paths are exact, per plan.md's Project Structure

## Path Conventions

Single repository: `convex/` (backend functions + schema), `src/` (Vite React app), `tests/` (Vitest unit
+ Playwright e2e) — all at the repo root, per plan.md's Structure Decision.

---

## Phase 1: Setup

**Purpose**: Project scaffolding, before any feature code

- [ ] T001 Initialize the Vite + React 18 + TypeScript project at the repo root (`package.json`, `vite.config.ts`); enable `strict: true` in `tsconfig.json` (constitution: Type Safety End-to-End)
- [ ] T002 Initialize Convex (`npx convex dev` scaffold) creating `convex/` and writing `VITE_CONVEX_URL`/`CONVEX_DEPLOYMENT` to `.env.local` (gitignored, per plan.md)
- [ ] T003 [P] Install and configure Tailwind CSS with a dark theme token set in `tailwind.config.ts` and `src/styles/index.css`
- [ ] T004 [P] Configure React Router v6 skeleton in `src/main.tsx` and `src/App.tsx` (empty route table for now)
- [ ] T005 [P] Configure Vitest + React Testing Library (`vitest.config.ts`, `tests/unit/` setup file)
- [ ] T006 [P] Configure `convex-test` for backend unit tests (test harness config referenced from `tests/unit/`)
- [ ] T007 [P] Configure Playwright (`playwright.config.ts`, `tests/e2e/` setup, multi-context support for two simulated users)
- [ ] T008 [P] Configure ESLint + Prettier enforcing TypeScript strict mode across `src/` and `convex/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, auth, and shared plumbing every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Define `convex/schema.ts`: extend Convex Auth's `authTables.users` in place with `avatarStorageId` (no separate profile table — data-model.md User, research.md §1), plus all 12 app tables (`servers`, `serverMembers`, `invites`, `channels`, `messages`, `directMessageThreads`, `directMessages`, `typingIndicators`, `presence`, `calls`, `callParticipants`, `signals`) with every index listed in data-model.md
- [ ] T010 Configure Convex Auth Password provider: `convex/auth.config.ts`, `convex/auth.ts` (`convexAuth({ providers: [Password] })`), `convex/http.ts` (`auth.addHttpRoutes`) — exact shapes in research.md §1
- [ ] T011 [P] Create `convex/lib/authz.ts` shared helpers: `requireServerMember`, `requireServerOwner`, `requireAuthor`, `requireCallParticipant`, all built on `getAuthUserId(ctx)` (research.md §1; every contract in contracts/convex-api.md routes through these)
- [ ] T012 [P] Create `convex/files.ts`: `generateUploadUrl` mutation shared by avatar and server-image uploads (contracts/convex-api.md files.ts)
- [ ] T013 [P] Create `src/lib/convexClient.ts` (`ConvexReactClient` construction) and wrap the app in `ConvexAuthProvider` in `src/main.tsx` (research.md §1)
- [ ] T014 [P] Build `src/App.tsx` route table plus an auth-gated route wrapper (redirect unauthenticated users to `/login`) using `useConvexAuth()`
- [ ] T015 Create `convex/users.ts`: `getMe`, `updateProfile` (contracts/convex-api.md users.ts, operating directly on the Convex Auth `users` row)

**Checkpoint**: Schema deployed, auth working, app shell renders behind a login gate — user story work can now begin

---

## Phase 3: User Story 1 - Sign Up, Log In & Presence (Priority: P1) 🎯 MVP slice 1/3

**Goal**: A new user can sign up, log in, and see accurate online/offline status for themselves and others.

**Independent Test**: Register a new account, log in, confirm the profile (name/avatar) is visible and shows "online" in a second session viewing the same user; log out and confirm the other session sees "offline" (spec.md US1).

- [ ] T016 [P] [US1] Build `src/routes/SignupPage.tsx` (email, password, display name, optional avatar form calling `useAuthActions().signIn("password", { flow: "signUp", ... })`)
- [ ] T017 [P] [US1] Build `src/routes/LoginPage.tsx` (email/password form calling `signIn("password", { flow: "signIn", ... })`)
- [ ] T018 [US1] Create `convex/presence.ts`: `heartbeat`, `clearMine`, `getForUsers` (contracts/convex-api.md presence.ts; research.md §2)
- [ ] T019 [US1] Create `convex/crons.ts` with the `sweepStalePresence` job (every 15s, 30s staleness threshold — research.md §2)
- [ ] T020 [US1] Create `src/lib/usePresenceHeartbeat.ts`: recurring `presence.heartbeat` call plus an immediate call on login, and wire `presence.clearMine` into the sign-out action for the eager offline transition (research.md §2)
- [ ] T021 [US1] Build a minimal authenticated landing view (`src/routes/Home.tsx`) rendering the caller's own profile (name/avatar) and an online indicator, sufficient to exercise the Independent Test
- [ ] T022 [P] [US1] Vitest test for `usePresenceHeartbeat` in `tests/unit/usePresenceHeartbeat.test.ts`
- [ ] T023 [P] [US1] `convex-test` tests for `presence.ts` (heartbeat upsert, `clearMine` deletion, auth requirement) in `tests/unit/presence.test.ts`

**Checkpoint**: US1 fully functional and independently testable

---

## Phase 4: User Story 2 - Create a Server and Chat in the Default Channel (Priority: P1) 🎯 MVP slice 2/3

**Goal**: A user creates a server, lands in a default "general" channel, and sends/receives messages in real time.

**Independent Test**: Create a server, confirm "general" exists automatically, send a message, confirm it appears immediately in another session viewing the same channel (spec.md US2).

- [ ] T024 [P] [US2] Create `convex/servers.ts`: `create` (atomically also creates the owner's `ServerMember` row and the default "general" `Channel` — FR-004/FR-005), `listForMe`, `get`, `rename` (contracts/convex-api.md servers.ts)
- [ ] T025 [P] [US2] Create `convex/channels.ts` with `listForServer` only for now (`create`/`rename`/`remove` land in US5)
- [ ] T026 [US2] Create `convex/messages.ts` with `send` and `list` (paginated, newest-first, **joined against `users` for `authorName`/`authorAvatarUrl`** — FR-016, data-model.md Message read-time-join note, contracts/convex-api.md messages.ts); `edit`/`remove` land in US4
- [ ] T027 [P] [US2] Build `src/routes/ServerLayout.tsx` (server rail + create-server action) and `src/components/layout/ServerRail.tsx`
- [ ] T028 [US2] Build `src/routes/ChannelPage.tsx` rendering the "general" channel via `usePaginatedQuery(api.messages.list, ...)`
- [ ] T029 [P] [US2] Build `src/components/chat/MessageList.tsx` and `MessageItem.tsx` (author name, avatar, timestamp, content per FR-016)
- [ ] T030 [P] [US2] Build `src/components/chat/MessageComposer.tsx` (send message, optimistic `insertAtTop` per research.md §7)
- [ ] T031 [P] [US2] Playwright smoke test `tests/e2e/send-message.spec.ts` — two browser contexts, one sends, the other sees it in real time (constitution-mandated minimum)
- [ ] T032 [P] [US2] `convex-test` tests for `servers.ts` (atomic create) in `tests/unit/servers.test.ts`
- [ ] T033 [P] [US2] `convex-test` tests for `messages.ts` `send`/`list` (membership authz, author join) in `tests/unit/messages.test.ts`

**Checkpoint**: US1 + US2 functional — core real-time chat loop works

---

## Phase 5: User Story 3 - Invite Others and See Member Presence (Priority: P1) 🎯 MVP slice 3/3

**Goal**: The owner invites others; a joiner becomes a member and sees the member sidebar with presence; any non-owner member can leave on their own.

**Independent Test**: Owner generates an invite link, a second user opens it and joins, both see each other in the member sidebar with correct status; that second user then leaves voluntarily (spec.md US3).

- [ ] T034 [P] [US3] Create `convex/invites.ts`: `getOrCreateForServer` (idempotent), `regenerate` (invalidates the old code), `consume` (data-model.md Invite regenerate semantics, contracts/convex-api.md invites.ts)
- [ ] T035 [P] [US3] Create `convex/serverMembers.ts`: `listForServer` (joined with `presence`), `leave` (FR-033, owner excluded — contracts/convex-api.md serverMembers.ts)
- [ ] T036 [US3] Build an invite-consumption route (e.g. `src/routes/JoinInvitePage.tsx`) that calls `invites.consume` and redirects into the joined server
- [ ] T037 [P] [US3] Build `src/components/layout/MemberList.tsx` (member sidebar with presence + a "leave server" action for non-owners)
- [ ] T038 [P] [US3] Add owner-only invite generation/copy/regenerate UI (e.g. in `ServerLayout.tsx` or a settings panel)
- [ ] T039 [P] [US3] `convex-test` tests for `invites.ts` and `serverMembers.ts` (join, leave, regenerate, owner-cannot-leave authz) in `tests/unit/invites.test.ts`

**Checkpoint**: US1 + US2 + US3 complete = the full P1 MVP slice, independently demoable

---

## Phase 6: User Story 4 - Message Lifecycle: Edit, Delete, Typing, History (Priority: P2)

**Goal**: Authors can edit/delete their own messages, members see typing indicators, and history loads via infinite scroll.

**Independent Test**: Edit a message (see "(edited)"), delete another, watch a typing indicator appear/clear, scroll to load older history (spec.md US4).

- [ ] T040 [US4] Extend `convex/messages.ts` with `edit` (sets `editedAt`, author-only) and `remove` (author-only) — FR-017/018/019
- [ ] T041 [US4] Create `convex/typingIndicators.ts`: `heartbeat`, `listForChannel` (FR-021, research.md §2)
- [ ] T042 [US4] Add the `sweepStaleTyping` job to `convex/crons.ts` (every 5s, 5s staleness threshold)
- [ ] T043 [P] [US4] Build `src/components/chat/TypingIndicator.tsx` and wire `MessageComposer.tsx`'s input handler to `typingIndicators.heartbeat`
- [ ] T044 [P] [US4] Add edit/delete controls to `MessageItem.tsx` for the current user's own messages, plus the "(edited)" marker
- [ ] T045 [US4] Wire `MessageList.tsx`'s scroll-to-top to `usePaginatedQuery`'s `loadMore` (FR-020, research.md §7)
- [ ] T046 [P] [US4] `convex-test` tests for `messages.ts` edit/remove authz and `typingIndicators.ts` in `tests/unit/messages-lifecycle.test.ts`

**Checkpoint**: US1–US4 functional

---

## Phase 7: User Story 5 - Channel Management (Priority: P2)

**Goal**: The owner creates/renames/deletes text and voice channels; all members see the current channel list.

**Independent Test**: Owner creates a text and a voice channel, renames one, deletes another; all members see updates immediately and the deleted channel's messages are gone (spec.md US5).

- [ ] T047 [US5] Extend `convex/channels.ts` with `create`, `rename`, `remove` (owner-only; `remove` cascades to delete the channel's `Message` rows and end any active `Call` — data-model.md Channel Cascade, FR-012/013)
- [ ] T048 [P] [US5] Build `src/components/layout/ChannelSidebar.tsx` (channel list split by text/voice, owner-only create/rename/delete controls)
- [ ] T049 [P] [US5] `convex-test` tests for `channels.ts` (owner-only authz, cascade delete) in `tests/unit/channels.test.ts`

**Checkpoint**: US1–US5 functional

---

## Phase 8: User Story 6 - Direct Messages (Priority: P2)

**Goal**: Any two users sharing a server can open a 1-on-1 DM that behaves like a channel.

**Independent Test**: Two users sharing a server open a DM, exchange messages in real time, edit/delete one (spec.md US6).

- [ ] T050 [P] [US6] Create `convex/directMessageThreads.ts`: `getOrCreateWithUser` (requires a shared server — FR-022), `listForMe` (contracts/convex-api.md)
- [ ] T051 [P] [US6] Create `convex/directMessages.ts`: `list` (paginated, author-joined same as `messages.ts`), `send`, `edit`, `remove` (FR-023)
- [ ] T052 [US6] Build `src/routes/DirectMessagePage.tsx` reusing `MessageList`/`MessageComposer` against the DM thread
- [ ] T053 [P] [US6] Add a DM entry point from `MemberList.tsx` (open/create a DM with a shared-server member)
- [ ] T054 [P] [US6] `convex-test` tests for `directMessageThreads.ts` and `directMessages.ts` in `tests/unit/direct-messages.test.ts`

**Checkpoint**: US1–US6 functional

---

## Phase 9: User Story 7 - Voice & Video Calls (Priority: P2)

**Goal**: Members join a voice channel's live call (or a DM's 1-on-1 call), see/hear each other, toggle mic/camera, see who's speaking/connected, and leave.

**Independent Test**: Two members join the same voice channel, confirm audio/video both ways, toggle mic/camera and see it reflected, confirm the channel list shows both connected, then start a 1-on-1 call from a DM (spec.md US7).

- [ ] T055 [US7] Create `convex/calls.ts`: `getOrCreateForChannel`, `getOrCreateForThread`, `join` (4-participant cap — FR-025), `leave`, `setMicCamera`, `listParticipants`, `listActiveForServer` (contracts/convex-api.md calls.ts)
- [ ] T056 [US7] Create `convex/signals.ts`: `send`, `listForMe`, `ack` (contracts/convex-api.md signals.ts — ack only after successful apply, research.md §3)
- [ ] T057 [US7] Add the `sweepOrphanedSignals` job to `convex/crons.ts` (every 60s, 5-minute age cutoff)
- [ ] T058 [US7] Build `src/features/calls/useWebRtcCall.ts`: the peer-connection registry (`Map<userId, PeerState>`), dual creation triggers (proactive from `listParticipants`, lazy from an unrecognized `signals.listForMe` sender), the perfect-negotiation handlers, `onicecandidate` wiring, and teardown on departure (research.md §3)
- [ ] T059 [US7] Add ICE restart handling to `useWebRtcCall.ts`: `connectionstatechange` → `restartIce()` on `"failed"`, debounced on `"disconnected"` (research.md §4)
- [ ] T060 [P] [US7] Build `src/features/calls/useSpeakingDetection.ts`: client-local Web Audio `AnalyserNode`-based speaking detection per track, never round-tripped through Convex (research.md §5, FR-028)
- [ ] T061 [P] [US7] Build `src/components/call/VideoTile.tsx` (renders a participant's video, mute state from `CallParticipant.micOn`, speaking state from T060) and `CallGrid.tsx`
- [ ] T062 [P] [US7] Build `src/components/call/CallControls.tsx` (mic/camera toggle → `calls.setMicCamera` + local track `enabled`, leave → `calls.leave`)
- [ ] T063 [US7] Build `src/routes/VoiceChannelPage.tsx` wiring `useWebRtcCall` + `CallGrid` + `CallControls` for a voice channel
- [ ] T064 [P] [US7] Wire `calls.listActiveForServer` into `ChannelSidebar.tsx` to show who's connected to each voice channel (FR-030)
- [ ] T065 [P] [US7] Add a "start video call" entry point to `DirectMessagePage.tsx` using `calls.getOrCreateForThread` (FR-031)
- [ ] T066 [P] [US7] Playwright smoke test `tests/e2e/join-call.spec.ts` — two contexts with `--use-fake-device-for-media-stream`, join the same voice channel, assert both see a connected remote video tile (constitution-mandated minimum)
- [ ] T067 [P] [US7] `convex-test` tests for `calls.ts` (4-participant cap, authz) and `signals.ts` in `tests/unit/calls.test.ts`

**Checkpoint**: US1–US7 functional — the full non-admin feature set works

---

## Phase 10: User Story 8 - Server Administration (Priority: P3)

**Goal**: The owner renames the server and removes members.

**Independent Test**: Owner renames the server and removes a member; all members see the new name, the removed member immediately loses access (spec.md US8).

- [ ] T068 [US8] Extend `convex/serverMembers.ts` with `remove` (owner-only, cannot target the owner — FR-010)
- [ ] T069 [P] [US8] Add owner-only rename-server and remove-member controls to `ServerLayout.tsx`/`MemberList.tsx` (`servers.rename` already exists from US2)
- [ ] T070 [P] [US8] `convex-test` tests for `serverMembers.remove` authz in `tests/unit/server-admin.test.ts`

**Checkpoint**: All 8 user stories independently functional

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T071 [P] Run every quickstart.md validation scenario end-to-end manually across two browser profiles
- [ ] T072 [P] Confirm `tsc --noEmit` passes with zero errors across `src/` and `convex/` (constitution: Type Safety End-to-End)
- [ ] T073 Review every function in `convex/*.ts` against contracts/convex-api.md's auth-rule column for 1:1 compliance (constitution: Security Basics gate)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1, US2, US3 (Phases 3–5, all P1)**: Depend only on Foundational; together they form the MVP. US2 and US3 both read `servers`/`serverMembers` created in US2's `servers.create`, so build US2 before US3 even though both are P1.
- **US4–US7 (Phases 6–9, all P2)**: Depend on Foundational; US4 extends files US2 created (`messages.ts`) but is additive, not breaking. US7 depends on channels existing (US5) for voice channels and on US6 for the DM-call entry point, so build US5 and US6 before US7.
- **US8 (Phase 10, P3)**: Depends on Foundational + US2 (servers) + US3 (serverMembers) already existing.
- **Polish (Phase 11)**: Depends on all desired user stories being complete.

### Recommended build order

Phase 1 → 2 → 3 (US1) → 4 (US2) → 5 (US3) → 6 (US4) → 7 (US5) → 8 (US6) → 9 (US7) → 10 (US8) → 11.
This matches spec.md's priority order (P1, P1, P1, P2, P2, P2, P2, P3) and plan.md's Incremental
Delivery mapping — the app builds and runs after every phase.

### Parallel Opportunities

- All [P]-marked Setup tasks (T003–T008) run in parallel.
- Within Foundational, T011–T014 run in parallel once T009/T010 land.
- Once Foundational is done, if staffed by multiple people, US1/US2/US3 can be split across developers — but note the servers→serverMembers ordering above if doing so.
- Within any story, [P] tasks touch different files and can run together (e.g., T029/T030 in US2; T061/T062 in US7).

---

## Parallel Example: User Story 2

```bash
# After T024 (servers.ts) and T026 (messages.ts) land, these can run together:
Task: "Build src/components/chat/MessageList.tsx and MessageItem.tsx"
Task: "Build src/components/chat/MessageComposer.tsx"
Task: "Playwright smoke test tests/e2e/send-message.spec.ts"
Task: "convex-test tests for servers.ts in tests/unit/servers.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1), Phase 4 (US2), Phase 5 (US3) in that order.
3. **STOP and VALIDATE**: run quickstart.md scenarios 1–3 independently.
4. This is the smallest deployable/demoable slice — a real-time chat community with accounts, servers, and invites, no editing/DMs/voice yet.

### Incremental Delivery

Add US4 → US5 → US6 → US7 → US8 in that order, validating each against its Independent Test (spec.md)
and its quickstart.md scenario before moving to the next. Every checkpoint above is a point where the app
builds, runs, and demoes — per the constitution's Incremental Delivery principle, never leave main broken
between checkpoints.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. One person takes US1 while another starts US2's backend (`servers.ts`/`channels.ts`/`messages.ts`) — both only depend on Foundational.
3. US3 needs US2's `servers.ts` to exist; US7 needs US5 (voice channels) and US6 (DM call entry point) to exist — sequence those two accordingly regardless of team size.

---

## Notes

- [P] tasks touch different files with no same-phase dependency.
- [Story] labels map every task back to spec.md's US1–US8 for traceability.
- The two constitution-mandated Playwright smoke tests are T031 (send-message) and T066 (join-call) — don't drop these even if other test tasks are deprioritized.
- Commit after each task or logical group; don't leave `main` in a non-building state between checkpoints (constitution: Incremental Delivery).
- Avoid: same-file conflicts within a single phase, and starting US7 before US5/US6 land.
