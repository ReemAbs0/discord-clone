# Discord Clone

A real-time chat and video-calling app modeled on Discord: accounts with presence, servers with
invite links, text channels and 1-on-1 DMs (live, editable), and up to-4-participant voice/video
calls — built on **React 18 + TypeScript (Vite)** on the front end and **[Convex](https://convex.dev)**
for the database, real-time subscriptions, and auth. Voice/video uses native **WebRTC** (full mesh,
STUN-only) with signaling carried over Convex — no separate backend server, no Socket.io, no RTC SDK.

Full product spec and design docs live in [`specs/001-discord-clone/`](specs/001-discord-clone/)
(`spec.md`, `plan.md`, `data-model.md`, `contracts/`, `research.md`, `quickstart.md`).

## Features

- **Accounts & presence** — email/password sign-up, display name + avatar, live online/offline status
- **Servers** — create a server, invite others via a link, member sidebar with presence, owner can
  rename the server and remove members
- **Channels** — default `#general`; owner creates/renames/deletes text & voice channels
- **Messaging** — real-time send, author-only edit/delete (marked *(edited)*), typing indicators,
  newest-first history with infinite scroll
- **Direct messages** — 1-on-1 conversations between members of a shared server, same behavior as channels
- **Voice/video** — join a voice channel or start a 1-on-1 call from a DM; toggle mic/camera, see video
  tiles, speaking indicators, and who's connected

Out of scope for v1: attachments, reactions, threads, roles beyond owner/member, screen sharing,
mobile apps, message search.

## Prerequisites

- **Node.js 20+** (developed on Node 24)
- A **[Convex](https://dashboard.convex.dev)** account (free) — the CLI will prompt you to log in on
  first run
- A machine with a **camera and microphone** to exercise the voice/video features
- A modern desktop browser (Chrome/Firefox/Safari/Edge). Mobile/responsive layouts are not a target.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Provision your Convex dev deployment (interactive: logs you in, creates the project,
#    generates convex/_generated/, and writes VITE_CONVEX_URL + CONVEX_DEPLOYMENT to .env.local).
#    Leave this running — it also watches and pushes convex/ changes.
npx convex dev
```

### One-time: configure auth signing keys

Convex Auth needs an RS256 keypair set as deployment environment variables. Generate and set them
with the official helper (this only sets env vars; it does **not** overwrite your `convex/` code):

```bash
npx @convex-dev/auth
```

If you prefer to verify they exist:

```bash
npx convex env list   # expect JWT_PRIVATE_KEY and JWKS to be set
```

> Without these, sign-up fails with `Missing environment variable JWT_PRIVATE_KEY`.

## Running

Use **two terminals**:

```bash
# Terminal 1 — Convex backend (watch + push)
npx convex dev

# Terminal 2 — Vite dev server (http://localhost:5173)
npm run dev
```

Open the printed URL. To try multi-user and call flows, open it in **two browser profiles** (or one
normal + one incognito window) so you have two independent sessions.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npx convex dev` | Run/watch the Convex backend (required alongside `npm run dev`) |
| `npm run build` | Type-check (`tsc --noEmit`) then build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint over `src/` and `convex/` |
| `npm run format` | Prettier write |
| `npm test` | Run unit tests (Vitest + `convex-test`) once |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | Playwright end-to-end smoke tests (needs the app running — see below) |
| `npm run convex:codegen` | Regenerate `convex/_generated/` types |

## Testing

- **Unit / backend** — `npm test`. Business logic and every Convex query/mutation's authorization are
  covered with Vitest and `convex-test` (runs against an in-memory backend, no deployment needed).
- **End-to-end smoke tests** — `npm run test:e2e`. Two Playwright specs exercise the constitution's
  named critical flows: **send-message** and **join-call** (the latter uses Chromium fake media
  devices, already configured in `playwright.config.ts`). These need the dev server + a reachable
  Convex deployment; Playwright starts the dev server automatically via its `webServer` config.
- **Manual QA** — real-time, multi-user, and camera/mic behavior must be checked by hand. Work through
  [`specs/001-discord-clone/manual-qa-checklist.md`](specs/001-discord-clone/manual-qa-checklist.md)
  (two browser sessions).

## Project structure

```text
convex/              # Backend: schema, auth, and all queries/mutations (this IS the backend)
  schema.ts          #   all tables + indexes
  auth.ts, http.ts   #   Convex Auth (password provider)
  lib/authz.ts       #   shared authorization helpers (used by every function)
  *.ts               #   servers, channels, messages, DMs, presence, typing, calls, signals, crons
src/
  routes/            # pages (login/signup, home, server, channel, voice, DM, DM call)
  components/        # layout (rail/sidebar/member list), chat, call UI
  features/calls/    # useWebRtcCall (mesh + perfect negotiation + ICE restart), speaking detection
  lib/               # Convex client, presence heartbeat, upload helper
tests/
  unit/              # Vitest + convex-test
  e2e/               # Playwright smoke tests
specs/001-discord-clone/   # spec, plan, data model, API contracts, quickstart, QA checklist
```

## Architecture notes

- **No custom server.** Convex functions under `convex/` are the backend; the client talks to them via
  typed `useQuery`/`useMutation` hooks. Reads are live subscriptions — the UI never polls.
- **Presence & typing** use lightweight heartbeat tables swept by Convex cron jobs; sign-out clears
  presence eagerly so "offline" shows within seconds.
- **Voice/video** is a full WebRTC mesh (≤4 peers) using the *perfect negotiation* pattern, with SDP
  offers/answers and ICE candidates exchanged through a `signals` table instead of a WebSocket server.
- **STUN-only, no TURN (v1):** calls may fail to connect on strict/symmetric-NAT networks. This is a
  known, documented limitation, not a bug.

## Environment variables

Written to `.env.local` by `npx convex dev` (git-ignored — never commit):

- `VITE_CONVEX_URL` — Convex deployment URL used by the browser client
- `CONVEX_DEPLOYMENT` — deployment the Convex CLI targets

Deployment-side (set via `npx @convex-dev/auth`, stored on Convex, not in the repo):

- `JWT_PRIVATE_KEY`, `JWKS` — Convex Auth signing keys
