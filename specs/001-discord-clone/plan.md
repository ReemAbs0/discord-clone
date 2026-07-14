# Implementation Plan: Discord Clone — Real-Time Chat & Video Platform

**Branch**: `001-discord-clone` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-discord-clone/spec.md`

## Summary

Build a Discord-style real-time chat and video-calling web app: users sign up/log in, create or join
servers via invite links, chat in text channels and DMs with live updates/typing indicators/edit-delete,
and join up to 4-participant voice/video calls in a voice channel or 1-on-1 from a DM. The whole stack
is React 18 + TypeScript on Vite for the frontend and Convex for database, real-time subscriptions,
and auth, with native WebRTC (full-mesh, STUN-only) for audio/video and Convex tables for signaling —
no separate backend server, no Socket.io, no RTC SDK.

## Technical Context

**Language/Version**: TypeScript 5.x in strict mode, throughout frontend and backend; Node.js 20+ runtime
for Convex functions; modern evergreen browsers (Chrome/Firefox/Safari/Edge) on the client.

**Primary Dependencies**: React 18, Vite, Tailwind CSS, React Router v6, Convex (`convex` client/server
SDK), `@convex-dev/auth` with the Password provider, native browser WebRTC (`RTCPeerConnection`,
`getUserMedia`) — no third-party RTC SDK (LiveKit/Twilio) and no component library.

**Storage**: Convex (real-time document database with reactive queries) — all tables defined in
`convex/schema.ts`; Convex file storage for avatar and server images.

**Testing**: Vitest + React Testing Library for frontend unit/component tests; `convex-test` for Convex
query/mutation unit tests; Playwright for smoke end-to-end tests covering the two critical flows the
constitution calls out by name — send a message, join a call.

**Target Platform**: Desktop web browsers with camera/microphone and WebRTC support. Mobile apps are
explicitly out of scope (per spec); mobile *web* is not a target either — layouts are not required to
be responsive below desktop widths.

**Project Type**: Web application, single repository — Vite frontend at the repo root, Convex backend
functions under `convex/`. No separate backend server process.

**Performance Goals** (from spec Success Criteria): channel/DM messages visible to other viewers within
1s (SC-002); an additional page of message history loads in under 1s (SC-005); presence changes visible
within 5s (SC-004); a new member can join via invite link and see channels within 30s (SC-003); ≥95% of
call attempts (2–4 participants) connect and stay stable for ≥15 minutes (SC-006).

**Constraints**: STUN-only signaling (`stun:stun.l.google.com:19302`), no TURN server — calls may fail
to connect on strict/symmetric NAT networks; this is a known, documented v1 limitation, not a bug to
fix now. Full-mesh WebRTC topology caps voice/video calls at 4 simultaneous participants (each added
participant adds an O(n) peer connection per existing participant, so mesh cost grows O(n²) — acceptable
only up to ~4). No message attachments, reactions, threads, message search, screen sharing, roles beyond
owner/member, or mobile apps (all explicitly out of scope per spec).

**Scale/Scope**: Student-project scale — small numbers of concurrent users per server/channel/call, not
production/internet scale. 8 prioritized user stories (spec.md), 12 app-defined Convex tables plus the
Convex Auth-owned `users` table extended in place (data-model.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Evaluation | Status |
|---|---|---|
| I. Simplicity First | Convex replaces a hand-rolled DB + REST/WS server, removing an entire layer rather than adding one. No component library. Native WebRTC (no LiveKit/Twilio SDK) is *more* code than an SDK, but it is a dependency the user explicitly chose to avoid — using no SDK is the fewer-dependencies choice, not a violation. All libraries used (React, Vite, Tailwind, React Router, Convex, `@convex-dev/auth`) are named directly in the user-supplied plan input, so nothing here is speculative. | PASS |
| II. Real-Time Correctness | Every view of server-mutable state (messages, presence, typing, channel list, call roster) is read via Convex `useQuery`, which is a live subscription — no polling, no manual refresh anywhere in the design. Presence/typing "staleness" is resolved by a periodic Convex cron *write* (sweeping/deleting stale rows), which pushes an instant reactive update to subscribers — the client never re-fetches on a timer. See research.md §2. | PASS |
| III. Type Safety End-to-End | TypeScript strict mode across `src/` and `convex/`. All database access goes through `convex/schema.ts`-typed queries/mutations (Convex generates typed `ctx.db` and typed client hooks from the schema) — no untyped raw queries cross the client/server boundary. | PASS |
| IV. Security Basics (NON-NEGOTIABLE) | Every Convex query/mutation begins by resolving the caller's identity via Convex Auth and checking authorization against the specific resource touched (server membership, channel's server membership, message authorship, call participancy) before any read/write. Shared authorization helpers live in `convex/lib/authz.ts` so every function uses the same checks — see contracts/convex-api.md, which states the auth rule per function. | PASS |
| V. Incremental Delivery | Convex functions are organized by domain (`users.ts`, `servers.ts`, `messages.ts`, `calls.ts`, …), matching the spec's user-story boundaries, so each user story (US1–US8) can be built and demoed independently without touching unrelated functions. tasks.md (next phase) will sequence work so the app builds and runs after each story. | PASS |
| VI. Testable Seams | Business logic is server-side in `convex/*.ts` (naturally separated from UI) plus client-side non-UI hooks under `src/features/*` (e.g., `useWebRtcCall`), separate from `src/components/*` presentation. Vitest covers logic in both layers; Playwright smoke-tests send-message and join-call end-to-end per the constitution's minimum bar. | PASS |

**Technology Constraints check**: TypeScript strict mode ✅; all real-time data via Convex reactive
queries, no polling ✅; no dependency introduced here that isn't listed in Primary Dependencies above ✅.

**Result**: No violations. Complexity Tracking table below is not needed.

### Post-Design Re-Check (after Phase 1)

Re-evaluated against `data-model.md` and `contracts/convex-api.md`:

- **Security Basics**: Every function in contracts/convex-api.md has an explicit auth rule, all
  routed through the same `convex/lib/authz.ts` helpers (no per-function ad-hoc checks) — confirmed.
- **Type Safety End-to-End**: Data model fields are fully typed (including union/enum fields like
  `Channel.type` and `Signal.type`); no `any`-shaped payload except `Signal.payload`, which is
  necessarily an opaque JSON string (SDP/ICE data) — documented as the one intentional exception, not
  a violation, since it never crosses into application logic untyped.
- **Simplicity First**: No new tables or functions beyond what research.md and the user's own suggested
  table list called for; uniqueness/ownership invariants are enforced in mutations rather than adding
  redundant fields (e.g., no separate `role` field duplicating `servers.ownerId`).
- **Real-Time Correctness**: Every query in contracts/convex-api.md is a live Convex query; no function
  list contains a manual "refresh"/"poll" style endpoint.

No new violations. Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-discord-clone/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── convex-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
convex/
├── schema.ts               # All table definitions + indexes (data-model.md)
├── auth.ts                 # Convex Auth config (Password provider)
├── auth.config.ts
├── users.ts                # profile queries/mutations (getMe/updateProfile on the Convex Auth users row)
├── files.ts                 # shared generateUploadUrl (avatar + server images alike)
├── servers.ts              # create, rename, get/list-for-user
├── serverMembers.ts        # join (via invite), leave, remove member, list-with-presence
├── invites.ts              # getOrCreateForServer/regenerate/consume invite links
├── channels.ts             # create/rename/delete text & voice channels
├── messages.ts              # send/edit/delete/paginated list (channel messages)
├── directMessageThreads.ts  # open-or-get, list-for-user
├── directMessages.ts        # send/edit/delete/paginated list (DM messages)
├── typingIndicators.ts       # heartbeat set + list-by-channel query
├── presence.ts                # heartbeat set + clearMine (eager logout) + list query
├── calls.ts                   # join/leave voice-channel or DM call, list participants, mic/camera toggle
├── signals.ts                  # write/read WebRTC signaling payloads, ack/delete after consumption
├── crons.ts                    # stale presence/typing/signal sweep jobs
└── lib/
    └── authz.ts                # shared requireServerMember/requireServerOwner/requireAuthor helpers

src/
├── main.tsx
├── App.tsx                     # React Router route table
├── routes/
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── Home.tsx                 # authenticated landing: own profile + online indicator + profile editing
│   ├── JoinInvitePage.tsx       # consumes an invite code (invites.consume) and redirects into the server
│   ├── ServerLayout.tsx         # server rail + channel sidebar + member list shell
│   ├── ChannelPage.tsx          # text channel chat pane
│   ├── VoiceChannelPage.tsx     # voice/video call UI for a voice channel
│   └── DirectMessagePage.tsx    # DM chat pane (with 1-on-1 video call entry point)
├── components/
│   ├── layout/                  # ServerRail, ChannelSidebar, MemberList
│   ├── chat/                    # MessageList, MessageItem, MessageComposer, TypingIndicator
│   └── call/                    # CallGrid, VideoTile, CallControls
├── features/                    # non-UI logic, separated per Testable Seams — only created where
│   └── calls/                   # genuine non-UI logic exists (Simplicity First); useWebRtcCall.ts and
│                                 # useSpeakingDetection.ts (research.md §3, §5) are the two hooks complex
│                                 # enough to need this now. Add auth/servers/messages/ siblings later only
│                                 # if their own logic actually grows past a thin useQuery/useMutation
│                                 # wrapper — don't pre-create them speculatively.
├── lib/
│   ├── convexClient.ts
│   └── usePresenceHeartbeat.ts  # recurring presence.heartbeat + clearMine on sign-out (research.md §2)
└── styles/
    └── index.css                # Tailwind entry + dark theme tokens

tests/
├── unit/                         # Vitest: src/features/* logic + convex-test for convex/*.ts
└── e2e/                          # Playwright smoke: send-message.spec.ts, join-call.spec.ts

.env.local                        # VITE_CONVEX_URL, CONVEX_DEPLOYMENT, etc. — never committed
```

**Structure Decision**: Single repository. The Vite React app lives at the repo root (`src/`); there is
no separate backend service — Convex functions under `convex/` *are* the backend, deployed by the Convex
CLI. This matches the user's explicit instruction ("single repo — Vite app at the root, Convex functions
in convex/") and Constitution Principle I (Simplicity First): one deployable unit, no client/server
folder split, no infra to stand up beyond `npx convex dev`.

## Complexity Tracking

*No constitution violations were identified — this table is intentionally empty.*
