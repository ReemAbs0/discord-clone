# Quickstart: Discord Clone

This is a validation guide, not a build guide — it proves the feature works end-to-end once implemented.
For entity/field details see [data-model.md](./data-model.md); for the exact functions being exercised
see [contracts/convex-api.md](./contracts/convex-api.md).

## Prerequisites

- Node.js 20+ and npm
- A Convex account and the Convex CLI (`npx convex dev` will prompt to log in / create a project on first run)
- Two browser profiles (or one regular + one incognito window) to simulate two different users at once
- A machine with a camera and microphone for the voice/video call scenarios

## Setup

```bash
npm install
npx convex dev        # provisions a dev deployment, writes CONVEX_DEPLOYMENT to .env.local, watches convex/
```

In a second terminal:

```bash
npm run dev            # starts the Vite dev server
```

`.env.local` must contain `VITE_CONVEX_URL` (written automatically by `npx convex dev`) and is never
committed. Open the printed local URL in both browser profiles.

## Validation scenarios

Each scenario maps to a user story's "Independent Test" in spec.md and should be run manually at least
once before considering that story done; `tests/e2e/*.spec.ts` (Playwright) automates the send-message
and join-call scenarios per the constitution's minimum testing bar.

### 1. Sign up, log in, presence (US1)

1. In browser A, sign up with a new email/password/display name.
2. In browser B, sign up with a second account.
3. Confirm each browser shows itself as logged in with its own display name/avatar.
4. **Expect**: once both are signed in and viewing a shared context (see scenario 3), each sees the other
   as online; closing browser B's tab should flip their status to offline in browser A within ~30s
   (presence sweep interval).

### 2. Create a server and chat (US2)

1. In browser A, create a server (name required, image optional).
2. **Expect**: a "general" text channel exists immediately; sending a message in it shows author name,
   avatar, and timestamp.
3. Open the same channel in a second tab of browser A (or have browser B join first — see scenario 3) and
   send a message from one tab.
4. **Expect**: the message appears in the other tab within ~1s, no refresh (SC-002).

### 3. Invite, join, member presence (US3)

1. In browser A (server owner), generate the invite link.
2. In browser B, open the link.
3. **Expect**: browser B becomes a member and can see the server's channels within ~30s of opening the
   link (SC-003); the member sidebar in both browsers lists both users with correct online status.
4. In browser B, leave the server voluntarily (FR-033).
5. **Expect**: browser B immediately loses access to the server's channels; browser A's member list
   updates to remove them.

### 4. Message lifecycle (US4)

1. Send a message from browser A; edit it.
2. **Expect**: browser B sees the updated content marked "(edited)".
3. Delete a different message from browser A.
4. **Expect**: it disappears from browser B's view too.
5. Start typing in browser A without sending.
6. **Expect**: browser B sees a typing indicator that clears a few seconds after typing stops.
7. Send enough messages to exceed one page, then scroll to the top of the loaded history in browser B.
8. **Expect**: older messages load automatically in under ~1s (SC-005), still overall newest-first.

### 5. Channel management (US5)

1. In browser A (owner), create a new text channel and a new voice channel.
2. **Expect**: both appear in browser B's channel list without a refresh.
3. Rename one channel; delete another that has messages in it.
4. **Expect**: the rename and removal (including the deleted channel's messages) are reflected in browser B.
5. In browser B (non-owner), confirm there is no UI path to create/rename/delete a channel.

### 6. Direct messages (US6)

1. From browser A, open a DM with browser B's user (must share the server joined in scenario 3).
2. Send, edit, and delete a message in the DM.
3. **Expect**: same real-time/edit/delete behavior as a channel, visible in browser B.

### 7. Voice & video calls (US7)

1. In browser A, join the voice channel created in scenario 5.
2. In browser B, join the same voice channel.
3. **Expect**: both see/hear each other; toggling mic or camera in one browser is reflected in the other
   within ~1s; a speaking indicator appears when someone talks.
4. Check the channel list in a third context (or browser A's sidebar) — **expect** it shows both users as
   connected to that voice channel (FR-030).
5. Leave the call from browser B.
6. **Expect**: browser A sees browser B removed from the connected list immediately.
7. From a DM (scenario 6), start a 1-on-1 video call.
8. **Expect**: the other party is invited into a live call the same way.
9. **Known limitation**: on a strict/symmetric-NAT network, steps 2–3 may fail to connect since v1 uses
   STUN only, no TURN (research.md §4) — this is expected, not a bug, for such networks.
10. **SC-006 verification note**: the ≥95%-success/≥15-minute reliability bar is validated manually by
    repeating steps 1–3 across several call attempts and network conditions, not by automated load
    testing — building dedicated reliability-measurement infrastructure was judged disproportionate to
    a student-project v1 (Simplicity First). Revisit if real usage surfaces call-drop complaints.

### 8. Server administration (US8)

1. In browser A (owner), rename the server.
2. **Expect**: browser B sees the new name.
3. Remove browser B's user from the server (distinct from browser B leaving voluntarily in scenario 3).
4. **Expect**: browser B immediately loses access.

## Automated tests

```bash
npm run test            # Vitest: src/features/* and convex/*.ts (via convex-test)
npm run test:e2e         # Playwright: send-message.spec.ts, join-call.spec.ts
```
