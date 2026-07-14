# Phase 1 Data Model: Discord Clone

All tables live in `convex/schema.ts`. Every table lists the indexes needed for its known access
patterns (per the user's explicit instruction to index every access pattern). Uniqueness (invite codes,
one membership per user/server, one thread per user pair, one active call-participant row per user/call)
is not enforced by Convex itself — each is checked at the top of the relevant mutation before insert, and
that check is documented here as an invariant.

## User *(spec: User)*

Identity itself (email, password hash, session) is owned by Convex Auth. This table holds the
app-specific profile fields, one row per authenticated identity.

| Field | Type | Notes |
|---|---|---|
| `authId` | `Id<"users">` from Convex Auth | Links this profile row to the Convex Auth identity |
| `name` | `string` | Display name; not required to be unique (Clarifications 2026-07-14) |
| `avatarUrl` | `string \| null` | Resolved URL from Convex file storage; `null` → client shows a default avatar |
| `createdAt` | `number` | |

**Indexes**: `by_authId` (`authId`) — resolve profile from the authenticated identity on every call.

## Server *(spec: Server)*

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | |
| `imageUrl` | `string \| null` | Optional, per FR-004 |
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
regenerate/replace a server's current invite.

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
