# Contracts: Convex Function API

Convex has no REST/GraphQL layer of its own — the "API" this app exposes is its set of typed queries
and mutations, called directly from React via generated hooks (`useQuery(api.x.y, args)` /
`useMutation(api.x.y)`). Each function below is a contract: its name, arguments, return shape, and —
per Constitution Principle IV (Security Basics, non-negotiable) — the authorization rule it MUST
enforce before doing anything else. "Auth rule" always implies "caller must be an authenticated user"
as a baseline; only the *additional*, resource-specific check is spelled out.

Every mutation that inserts, edits, or deletes MUST use the shared helpers in `convex/lib/authz.ts`
(`requireServerMember`, `requireServerOwner`, `requireChannelMember`, `requireAuthor`,
`requireCallParticipant`, etc.) rather than re-implementing checks inline, so the rule is enforced
identically everywhere it applies. `requireChannelMember` was added during implementation — channels
are scoped by server, not membership directly, so it resolves the channel's server first.

## users.ts

`getMe`/`updateProfile` operate on the Convex Auth-owned `users` row itself (data-model.md's update:
there is no separate profile table) via `getAuthUserId(ctx)`.

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `getMe` | query | `{}` | `{ id, name, email, avatarUrl } \| null` | Caller reads only their own row (`ctx.db.get(getAuthUserId(ctx))`). `id` added during implementation — the frontend needs it to reference "myself" in other queries (e.g. `presence.getForUsers`) |
| `updateProfile` | mutation | `{ name?: string, avatarStorageId?: Id<"_storage"> }` | `void` | Caller may only update their own row |

## files.ts

Shared by both user-avatar and server-image uploads — one generic upload-URL mutation rather than two
near-identical ones (Simplicity First).

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `generateUploadUrl` | mutation | `{}` | `string` (upload URL) | Any authenticated user |

## servers.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `create` | mutation | `{ name: string, imageStorageId?: Id<"_storage"> }` | `Id<"servers">` | Any authenticated user; caller becomes `ownerId` and gets a `ServerMember` row + default "general" `Channel` created atomically (FR-004, FR-005) |
| `listForMe` | query | `{}` | `Server[]` | Returns only servers where caller has a `ServerMember` row |
| `get` | query | `{ serverId }` | `Server` | Caller must be a member (`requireServerMember`) |
| `rename` | mutation | `{ serverId, name: string }` | `void` | Caller must be the owner (`requireServerOwner`) |

## invites.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `getOrCreateForServer` | mutation | `{ serverId }` | `{ code: string }` | Caller must be the owner; idempotent — returns the existing invite if one exists, never rotates it |
| `regenerate` | mutation | `{ serverId }` | `{ code: string }` | Caller must be the owner; deletes the current invite and creates a new one, invalidating the old code (data-model.md Invite section) |
| `consume` | mutation | `{ code: string }` | `{ serverId }` | Any authenticated user; creates a `ServerMember` row if one doesn't already exist (idempotent re-join) |

## serverMembers.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `listForServer` | query | `{ serverId }` | `(ServerMember & { name, avatarUrl, online })[]` | Caller must be a member; joins `Presence` per row |
| `leave` | mutation | `{ serverId }` | `void` | Caller must be a member and must NOT be the owner (FR-033 / Assumptions) |
| `remove` | mutation | `{ serverId, userId }` | `void` | Caller must be the owner; target must not be the owner (FR-010) |

## channels.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `listForServer` | query | `{ serverId }` | `Channel[]` | Caller must be a member (FR-011) |
| `create` | mutation | `{ serverId, name: string, type: "text" \| "voice" }` | `Id<"channels">` | Caller must be the owner |
| `rename` | mutation | `{ channelId, name: string }` | `void` | Caller must be the owner of the channel's server |
| `remove` | mutation | `{ channelId }` | `void` | Caller must be the owner; cascades delete of the channel's `Message` rows and ends any active `Call` (FR-013, Edge Cases) |

## messages.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `list` | query (paginated) | `{ channelId, paginationOpts }` | `PaginationResult<Message & { authorName: string, authorAvatarUrl: string \| null }>` | Caller must be a member of the channel's server; joins `users` by `authorId` per row (FR-016 — see data-model.md Message) |
| `send` | mutation | `{ channelId, content: string }` | `Id<"messages">` | Caller must be a member |
| `edit` | mutation | `{ messageId, content: string }` | `void` | Caller must be the message's author (`requireAuthor`) — sets `editedAt` |
| `remove` | mutation | `{ messageId }` | `void` | Caller must be the message's author |

## directMessageThreads.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `getOrCreateWithUser` | mutation | `{ otherUserId }` | `Id<"directMessageThreads">` | Caller and `otherUserId` must currently share at least one server (FR-022) |
| `listForMe` | query | `{}` | `(DirectMessageThread & { otherUser })[]` | Caller must be one of the two participants |

## directMessages.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `list` | query (paginated) | `{ threadId, paginationOpts }` | `PaginationResult<DirectMessage & { authorName: string, authorAvatarUrl: string \| null }>` | Caller must be a participant in the thread; same author join as `messages.list` |
| `send` | mutation | `{ threadId, content: string }` | `Id<"directMessages">` | Caller must be a participant |
| `edit` | mutation | `{ messageId, content: string }` | `void` | Caller must be the message's author |
| `remove` | mutation | `{ messageId }` | `void` | Caller must be the message's author |

## typingIndicators.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `heartbeat` | mutation | `{ channelId }` | `void` | Caller must be a member of the channel's server; upserts caller's row |
| `listForChannel` | query | `{ channelId }` | `{ userId, name }[]` | Caller must be a member |

## presence.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `heartbeat` | mutation | `{}` | `void` | Any authenticated user; upserts caller's own row |
| `clearMine` | mutation | `{}` | `void` | Any authenticated user; deletes caller's own row immediately — called from the sign-out action so logout is reflected instantly rather than waiting on the cron sweep (SC-004; data-model.md Presence) |
| `getForUsers` | query | `{ userIds: Id<"users">[] }` | `{ userId, online }[]` | Any authenticated user (presence is not membership-scoped) |

## calls.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `getOrCreateForChannel` | mutation | `{ channelId }` | `Id<"calls">` | Caller must be a member of the channel's server |
| `getOrCreateForThread` | mutation | `{ threadId }` | `Id<"calls">` | Caller must be a thread participant |
| `join` | mutation | `{ callId }` | `Id<"callParticipants">` | Caller must be authorized for the call's channel/thread; rejected with a "channel full" error if 4 active participants already exist (FR-025) |
| `leave` | mutation | `{ callId }` | `void` | Caller must be an active participant; sets `leftAt`; ends the call if no active participants remain |
| `setMicCamera` | mutation | `{ callId, micOn?: boolean, cameraOn?: boolean }` | `void` | Caller may only update their own `CallParticipant` row |
| `listParticipants` | query | `{ callId }` | `CallParticipant[]` | Caller must be authorized for the call's channel/thread |
| `listActiveForServer` | query | `{ serverId }` | `{ channelId, participantUserIds }[]` | Caller must be a member — powers "who's connected" in the channel list (FR-030) |

## signals.ts

| Function | Type | Args | Returns | Auth rule |
|---|---|---|---|---|
| `send` | mutation | `{ callId, toUserId, type, payload }` | `void` | Caller must be an active participant in `callId`; `toUserId` must also be an active participant. Called for **both** SDP descriptions (offer/answer, from `onnegotiationneeded`) and ICE candidates (from `onicecandidate` — see research.md §3, which previously only showed the receiving half) |
| `listForMe` | query | `{ callId }` | `Signal[]` | Caller must be an active participant; returns rows addressed to caller, from every remote peer in the call — the client dispatches each row to the right local `RTCPeerConnection` by `fromUserId` (research.md §3's peer registry) |
| `ack` | mutation | `{ signalId }` | `void` | Caller must be the signal's `toUserId`; deletes the row. **Timing**: call only *after* the row has been successfully applied (`setRemoteDescription`/`addIceCandidate` resolved) — never ack-then-apply, so a failed apply leaves the row for the next reactive re-render to retry rather than silently losing it |

## crons.ts (not caller-invoked — scheduled)

| Job | Schedule | Action |
|---|---|---|
| `sweepStalePresence` | every 15s | Delete `Presence` rows with `lastActiveAt` older than 30s |
| `sweepStaleTyping` | every 5s | Delete `TypingIndicator` rows with `lastActiveAt` older than 5s |
| `sweepOrphanedSignals` | every 60s | Delete `Signal` rows older than 5 minutes (safety net if a client never acks) |
