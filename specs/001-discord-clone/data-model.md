# Phase 1 Data Model: Discord Clone

All tables live in `convex/schema.ts`. Every table lists the indexes needed for its known access
patterns (per the user's explicit instruction to index every access pattern). Uniqueness (invite codes,
one membership per user/server, one thread per user pair, one active call-participant row per user/call)
is not enforced by Convex itself — each is checked at the top of the relevant mutation before insert, and
that check is documented here as an invariant.

## User *(spec: User)*

**Superseded by research.md §1's verification pass**: Convex Auth's `authTables` (from
`@convex-dev/auth/server`) already defines a `users` table (`name`, `image`, `email`,
`emailVerificationTime`, `phone`, `phoneVerificationTime`, `isAnonymous`, indexed on `email`). The
correct, current pattern is to **extend that same table inline in `convex/schema.ts`**, not keep a
second profile table linked by an `authId` foreign key. There is exactly one `users` row per
identity — it *is* the identity.

| Field | Type | Notes |
|---|---|---|
| `name` | `string \| undefined` | Convex Auth's own field; used as the display name. Not required to be unique (Clarifications 2026-07-14) |
| `image` | `string \| undefined` | Convex Auth's own field; unused here (see `avatarStorageId` below for how this app actually resolves an avatar) |
| `email` | `string \| undefined` | Convex Auth's own field; the login identifier (FR-001) |
| `avatarStorageId` | `Id<"_storage"> \| undefined` | **App addition.** Resolved to a URL client-side via `ctx.storage.getUrl`; `undefined` → client shows a default avatar |

No app-defined index is needed to resolve "the current user" — every query/mutation gets it directly
via `getAuthUserId(ctx)` (research.md §1), which returns the `Id<"users">` of this same row. The
`email` index Convex Auth already defines is sufficient for anything auth-related; no additional
`by_authId`-style index applies since there is no second table to join.

## Server *(spec: Server)*

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | |
| `imageStorageId` | `Id<"_storage"> \| undefined` | Optional, per FR-004. Stores the storage ID, not a resolved URL — resolved at read time (same pattern as `users.avatarStorageId`), corrected during implementation for the same staleness reason |
| `ownerId` | `Id<"users">` | The creator; ownership is not transferable in v1 (Assumptions) |
| `createdAt` | `number` | |

**Indexes**: `by_owner` (`ownerId`) — not on the hot path but useful for admin/debug listing.

*Invariant*: A server's owner is also always represented by a `ServerMember` row for that server (see
below) — ownership is derived by comparing `serverMembers.userId === servers.ownerId`, not duplicated
as a `role` field, to avoid two sources of truth going out of sync.

## ServerMember *(spec: Membership)*

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | |
| `userId` | `Id<"users">` | |
| `joinedAt` | `number` | |

**Indexes**: `by_server` (`serverId`) — list a server's members + sidebar presence join; `by_user`
(`userId`) — list a user's servers; `by_server_and_user` (`serverId`, `userId`) — membership check on
every server/channel/message access, and to enforce the one-row-per-(server,user) invariant before insert.

## Invite *(spec: Invite)*

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | |
| `code` | `string` | Random URL-safe token; reusable, non-expiring (Assumptions) |
| `createdBy` | `Id<"users">` | Must be the server owner (FR-006) |
| `createdAt` | `number` | |

**Indexes**: `by_code` (`code`) — resolve an invite link to a server on open; `by_server` (`serverId`) —
find a server's current invite (to display it, or to delete it on regenerate).

*Regenerate semantics (resolves an ambiguity between FR-006 and the Assumptions section)*: a server has
at most one active `Invite` row at a time. `invites.getOrCreateForServer` is idempotent — it returns the
existing code if one exists, never creating a second. A separate `invites.regenerate` mutation deletes
the current row and inserts a fresh one with a new `code`, invalidating the old link (matches "the owner
can generate a new link at any time" in Assumptions, without the ambiguity of `getOrCreate` silently
rotating on every call).

## Channel *(spec: Channel)*

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | |
| `name` | `string` | |
| `type` | `"text" \| "voice"` | |
| `createdAt` | `number` | |

**Indexes**: `by_server` (`serverId`) — list all channels for a server (FR-011); `by_server_and_type`
(`serverId`, `type`) — split text vs. voice channels in the sidebar.

*Cascade*: deleting a channel deletes all `Message` rows with that `channelId` (FR-013), and, if it's a
voice channel, ends any active `Call` tied to it (Edge Cases).

## Message *(spec: Message, channel-scoped)*

| Field | Type | Notes |
|---|---|---|
| `channelId` | `Id<"channels">` | |
| `authorId` | `Id<"users">` | |
| `content` | `string` | |
| `editedAt` | `number \| null` | Non-null → render "(edited)" (FR-017) |
| `createdAt` | `number` | |

**Indexes**: `by_channel_and_creation` (`channelId`, `_creationTime`) — paginated, newest-first history
load (FR-020) via `.order("desc").paginate(...)`.

*Invariant*: only `authorId === caller` may edit/delete a row (FR-019).

*Read-time join, not a stored field*: FR-016 requires every message to display the author's display
name and avatar. `messages.list` (contracts/convex-api.md) MUST join each row against `users` by
`authorId` and return an enriched shape (`Message & { authorName: string, authorAvatarUrl: string | null }`),
not the raw stored document — storing a denormalized copy on the message itself would go stale the
moment a user changes their name/avatar.

## DirectMessageThread *(spec: Direct Message Conversation)*

| Field | Type | Notes |
|---|---|---|
| `userAId` | `Id<"users">` | Lower of the two IDs, canonical ordering |
| `userBId` | `Id<"users">` | Higher of the two IDs |
| `createdAt` | `number` | |

**Indexes**: `by_users` (`userAId`, `userBId`) — find-or-create the thread for a pair, enforcing the
one-thread-per-pair invariant; `by_userA` and `by_userB` — list a user's DM threads (two indexes because
a user can appear in either slot of the canonical pair).

*Invariant*: creating a thread requires the two users currently share at least one server (FR-022);
once created, the thread remains accessible even if they later stop sharing a server (Assumptions).

## DirectMessage *(spec: Message, DM-scoped)*

| Field | Type | Notes |
|---|---|---|
| `threadId` | `Id<"directMessageThreads">` | |
| `authorId` | `Id<"users">` | |
| `content` | `string` | |
| `editedAt` | `number \| null` | |
| `createdAt` | `number` | |

**Indexes**: `by_thread_and_creation` (`threadId`, `_creationTime`) — same pagination pattern as `Message`.

*Read-time join*: same as `Message` above — `directMessages.list` returns `DirectMessage & { authorName, authorAvatarUrl }`, joined against `users` at read time, not stored denormalized.

## TypingIndicator *(ephemeral, per Clarifications/Assumptions)*

| Field | Type | Notes |
|---|---|---|
| `channelId` | `Id<"channels">` | Scoped to text channels only, per FR-021 |
| `userId` | `Id<"users">` | |
| `lastActiveAt` | `number` | Heartbeat timestamp; swept by cron when stale (research.md §2) |

**Indexes**: `by_channel` (`channelId`) — list current typists in a channel; `by_channel_and_user`
(`channelId`, `userId`) — upsert this user's own heartbeat row.

## Presence *(ephemeral)*

| Field | Type | Notes |
|---|---|---|
| `userId` | `Id<"users">` | |
| `lastActiveAt` | `number` | Heartbeat timestamp; swept by cron when stale |

**Indexes**: `by_user` (`userId`) — upsert on heartbeat, and look up a specific user's status; presence
for a server's member list is resolved by joining each `ServerMember.userId` against this table
client-side/in-query, not by a server-scoped index (presence itself has no server concept).

*Reconciling with SC-004 ("within 5 seconds")*: see research.md §2 — an explicit sign-out calls
`presence.clearMine` (row delete) directly, which is reflected to other subscribers in well under 5s
like any other write. The passive cron sweep (crash/closed-laptop case, no explicit "offline" event to
react to) is deliberately on a longer cadence and is documented as a best-effort case outside the 5s
target, not a mechanism expected to hit it.

## Call *(spec: Call)*

| Field | Type | Notes |
|---|---|---|
| `kind` | `"voice-channel" \| "dm"` | |
| `channelId` | `Id<"channels"> \| null` | Set when `kind = "voice-channel"` |
| `threadId` | `Id<"directMessageThreads"> \| null` | Set when `kind = "dm"` |
| `startedAt` | `number` | |
| `endedAt` | `number \| null` | Non-null once the last participant leaves |

**Indexes**: `by_channel` (`channelId`) — find/create the active call for a voice channel; `by_thread`
(`threadId`) — find/create the active call for a DM.

## CallParticipant *(spec: Call, participant rows)*

| Field | Type | Notes |
|---|---|---|
| `callId` | `Id<"calls">` | |
| `userId` | `Id<"users">` | |
| `joinedAt` | `number` | |
| `leftAt` | `number \| null` | Non-null → no longer counted toward the 4-participant cap |
| `micOn` | `boolean` | |
| `cameraOn` | `boolean` | |

**Indexes**: `by_call` (`callId`) — list active participants (filter `leftAt = null`) and enforce the
4-participant cap (FR-025) before inserting a new row; `by_call_and_user` (`callId`, `userId`) — find
this user's own row to toggle mic/camera or mark `leftAt`.

*FR-028's "speaking" half is deliberately NOT a field here*: unlike `micOn`/`cameraOn` (explicit user
actions, needed by every other participant so belong in shared state), "is this participant currently
speaking" is derived continuously from a live audio signal and must never round-trip through Convex —
see research.md §5 for the client-local Web Audio API detection this relies on instead.

## Signal *(spec: not a spec-level entity — WebRTC signaling transport for Call)*

| Field | Type | Notes |
|---|---|---|
| `callId` | `Id<"calls">` | |
| `fromUserId` | `Id<"users">` | |
| `toUserId` | `Id<"users">` | |
| `type` | `"offer" \| "answer" \| "ice-candidate"` | |
| `payload` | `string` | JSON-encoded SDP or ICE candidate |
| `createdAt` | `number` | |

**Indexes**: `by_call_and_recipient` (`callId`, `toUserId`) — the recipient's live subscription for
inbound signaling messages (research.md §3); rows are deleted via an `ack` mutation once consumed.

## Entity relationship summary

```text
User ──< ServerMember >── Server ──< Channel ──< Message
                              │
                              └──< Invite

User ──< DirectMessageThread >── User
DirectMessageThread ──< DirectMessage

Channel ──< TypingIndicator >── User
User ──< Presence

Channel ──(0..1 active)── Call ──< CallParticipant >── User
DirectMessageThread ──(0..1 active)── Call
Call ──< Signal >── User (fromUserId / toUserId)
```
