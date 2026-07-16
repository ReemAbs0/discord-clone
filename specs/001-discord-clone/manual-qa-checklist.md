# Manual QA Checklist (T072)

**Why manual:** the app is real-time, multi-user, and uses camera/mic + WebRTC. These flows
can't be verified from the implementation environment — they need two real browser sessions
(use two profiles, or one normal + one incognito window) and a machine with a camera/mic.

**Setup:** `npx convex dev` (one terminal) + `npm run dev` (another), then open the printed URL in
both browsers. Full prerequisites/commands are in [quickstart.md](./quickstart.md).

Legend: ⬜ not run · ✅ pass · ❌ fail (note what happened)

## Scenario 1 — Sign up, log in, presence (US1)
- ⬜ Sign up in browser A (email, password, display name, optional avatar) → lands logged in
- ⬜ Sign up a second account in browser B
- ⬜ Each shows its own display name/avatar
- ⬜ Once both are in a shared context, each sees the other as **online**
- ⬜ Close browser B's tab → within ~30s browser A shows them **offline**
- ⬜ Log out → the other session sees offline within ~5s (eager transition, SC-004)

## Scenario 2 — Create a server & chat (US2)
- ⬜ Create a server → a **#general** text channel exists automatically
- ⬜ Send a message → shows author name, avatar, timestamp
- ⬜ Message appears in a second session within ~1s, no refresh (SC-002)

## Scenario 3 — Invite, join, member presence (US3)
- ⬜ Owner clicks **Invite people**, copies the link
- ⬜ Browser B opens the link → joins, sees the channels within ~30s (SC-003)
- ⬜ Both see each other in the member sidebar with correct online/offline status
- ⬜ Browser B (non-owner) leaves the server → immediately loses access; A's member list updates
- ⬜ Owner regenerates the invite → the old link no longer works

## Scenario 4 — Message lifecycle (US4)
- ⬜ Edit a message → other session sees updated content marked **(edited)**
- ⬜ Delete a message → disappears for both
- ⬜ Typing in one session shows a typing indicator in the other; clears a few seconds after stopping
- ⬜ In a channel with >25 messages, scroll to the top → older history loads without the view jumping (SC-005)
- ⬜ A non-author sees no edit/delete controls on others' messages

## Scenario 5 — Channel management (US5)
- ⬜ Owner creates a text channel and a voice channel → both appear in every member's sidebar
- ⬜ Owner renames a channel → new name visible to all
- ⬜ Owner deletes a channel with messages → channel + its messages gone for everyone
- ⬜ Non-owner sees no create/rename/delete controls
- ⬜ Deleting the channel you're viewing redirects you to the default channel (no crash)

## Scenario 6 — Direct messages (US6)
- ⬜ From the member list, open a DM with a shared-server member (💬)
- ⬜ Exchange messages in real time
- ⬜ Edit and delete a DM message → same behavior as a channel
- ⬜ Existing DM still works after the two users stop sharing a server

## Scenario 7 — Voice & video calls (US7) — *needs camera/mic*
- ⬜ Two members join the same voice channel → each sees the other's tile; audio works
- ⬜ Toggle mic and camera → reflected on the other side within ~1s
- ⬜ Speaking indicator (ring) appears when someone talks
- ⬜ Channel sidebar shows who's connected under the voice channel (FR-030)
- ⬜ One leaves → removed from the other's grid and the connected list immediately
- ⬜ Fill a call to 4, then a 5th tries to join → sees "channel full", not connected (FR-025)
- ⬜ Start a 1-on-1 video call from a DM (📹)
- ⬜ **Known limitation:** on strict/symmetric NAT, connection may fail (STUN-only, no TURN — research.md §5). Not a bug.

## Scenario 8 — Server administration (US8)
- ⬜ Owner renames the server → all members see the new name (~5s)
- ⬜ Owner removes a member → that member immediately loses access

## Regressions found & fixed during verification (re-confirm)
- ⬜ **JWT/signup:** signing up succeeds (no "Missing environment variable JWT_PRIVATE_KEY")
- ⬜ **Signup avatar race:** signing up *with* an avatar succeeds (no "Not authenticated" on upload)
- ⬜ **Persistent shell:** after login you land on Home with the server rail visible; can create/pick a server
- ⬜ **Call leave:** joining then leaving a voice channel does not error ("Not an active participant")
- ⬜ **Removed-while-viewing:** being removed from a server you're currently viewing redirects you Home
      with the server gone from the rail — no crash
- ⬜ Normal navigation away from a server still works (no false redirect)

## Success criteria spot-checks (SC-001…SC-008)
- ⬜ SC-001: new user can sign up and send a first message within 2 minutes
- ⬜ SC-006: a 2–4 person call stays stable ~15 min (manual/best-effort per quickstart note)
