import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// data-model.md is the source of truth for every table/index below.
export default defineSchema({
  ...authTables,

  // Extends Convex Auth's own `users` table in place (research.md §1) rather
  // than keeping a second profile table — there is exactly one `users` row
  // per identity, and it *is* the identity.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    avatarStorageId: v.optional(v.id("_storage")),
  }).index("email", ["email"]),

  servers: defineTable({
    name: v.string(),
    // Stores the storage ID, not a resolved URL — resolved at read time
    // (same pattern as users.avatarStorageId), so a rotated/expired storage
    // URL never goes stale in the document itself.
    imageStorageId: v.optional(v.id("_storage")),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_and_user", ["serverId", "userId"]),

  invites: defineTable({
    serverId: v.id("servers"),
    code: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_server", ["serverId"]),

  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_server_and_type", ["serverId", "type"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_channel_and_creation", ["channelId"]),

  directMessageThreads: defineTable({
    userAId: v.id("users"), // lower of the two user IDs, canonical ordering
    userBId: v.id("users"), // higher of the two user IDs
    createdAt: v.number(),
  })
    .index("by_users", ["userAId", "userBId"])
    .index("by_userA", ["userAId"])
    .index("by_userB", ["userBId"]),

  directMessages: defineTable({
    threadId: v.id("directMessageThreads"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_thread_and_creation", ["threadId"]),

  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    lastActiveAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_and_user", ["channelId", "userId"]),

  presence: defineTable({
    userId: v.id("users"),
    lastActiveAt: v.number(),
  }).index("by_user", ["userId"]),

  calls: defineTable({
    kind: v.union(v.literal("voice-channel"), v.literal("dm")),
    channelId: v.optional(v.id("channels")),
    threadId: v.optional(v.id("directMessageThreads")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_channel", ["channelId"])
    .index("by_thread", ["threadId"]),

  callParticipants: defineTable({
    callId: v.id("calls"),
    userId: v.id("users"),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
    micOn: v.boolean(),
    cameraOn: v.boolean(),
  })
    .index("by_call", ["callId"])
    .index("by_call_and_user", ["callId", "userId"]),

  signals: defineTable({
    callId: v.id("calls"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_call_and_recipient", ["callId", "toUserId"]),
});
