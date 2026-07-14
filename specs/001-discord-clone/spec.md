# Feature Specification: Discord Clone — Real-Time Chat & Video Platform

**Feature Branch**: `001-discord-clone`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Build a real-time chat and video calling application modeled on Discord. Users & auth: Users sign up and log in. Each user has a display name and avatar. A user's online/offline status is visible to others. Servers: A logged-in user can create a server (a named community with an optional image). The creator becomes its owner. Users join servers via an invite link the owner can generate. A server lists its members and their online status in a sidebar. Owners can rename the server and remove members. Channels: Every server starts with a default \"general\" text channel. Members can see all channels; the owner can create, rename, and delete text channels and voice channels. Deleting a channel removes its messages. Messaging: Inside a text channel, members send text messages. Messages appear for all members in real time without refreshing. Each message shows author name, avatar, timestamp, and content. Authors can edit and delete their own messages; edits are marked. Messages load newest-first with infinite scroll for history. Typing indicators show when someone is composing. Direct messages: Any user can open a 1-on-1 DM conversation with another member of a shared server. DMs behave like channels (real time, edit, delete). Voice/video calls: A member can join a voice channel, which starts or joins a live call with the other members currently in that channel (support at least 2, target up to 4 participants). Participants can toggle their microphone and camera, see each other's video tiles, see who is speaking/muted, and leave the call. The channel list shows who is currently connected to each voice channel. 1-on-1 video calls can also be started from a DM. Out of scope for v1: message attachments/files, reactions, threads, roles/permissions beyond owner vs member, screen sharing, mobile apps, message search."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign Up, Log In & Presence (Priority: P1)

A new user creates an account with a display name and avatar, logs in, and can see that they now show up to others as "online." When they close the app or log out, others see them as "offline."

**Why this priority**: Nothing else in the system is reachable without an identity. This is the foundation every other story depends on.

**Independent Test**: Can be fully tested by registering a new account, logging in, and confirming the user's own profile (display name, avatar) is visible and their status shows "online" in a second session viewing the same user; delivers a working identity and presence system on its own.

**Acceptance Scenarios**:

1. **Given** no existing account, **When** a person signs up with a display name and (optionally) an avatar, **Then** an account is created and they are logged in.
2. **Given** a registered user, **When** they log in with valid credentials, **Then** they reach the main application view.
3. **Given** a logged-in user, **When** another user views a list that includes them, **Then** that user appears with an "online" indicator.
4. **Given** an online user, **When** they log out or their session ends, **Then** other users see their status change to "offline."

---

### User Story 2 - Create a Server and Chat in the Default Channel (Priority: P1)

A logged-in user creates a new server by giving it a name (and optionally an image). They become the server's owner and land in a default "general" text channel, where they can send messages that appear instantly for anyone else in the channel.

**Why this priority**: This is the core chat loop — a community to talk in and real-time messaging — the minimum viable slice of the product's value.

**Independent Test**: Can be fully tested by creating a server, confirming a "general" channel exists automatically, sending a message, and confirming it appears immediately (no manual refresh) in another session viewing the same channel; delivers a working real-time chat space on its own.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a server with a name, **Then** the server is created, they become its owner, and a default "general" text channel exists.
2. **Given** a member viewing the "general" channel, **When** they send a text message, **Then** the message appears in the channel with their name, avatar, and timestamp.
3. **Given** two members viewing the same channel, **When** one sends a message, **Then** the other sees it appear in real time without refreshing the page.

---

### User Story 3 - Invite Others and See Member Presence (Priority: P1)

The server owner generates an invite link and shares it. Another user opens the link, joins the server, and appears in a member sidebar that shows every member's current online/offline status.

**Why this priority**: A chat platform has no value alone — this story turns a single-person space into a shared community, which is the point of the product.

**Independent Test**: Can be fully tested by having the owner generate an invite link, a second user opening it and joining, and both users then seeing each other listed in the member sidebar with accurate online/offline status; delivers working multi-user community access on its own.

**Acceptance Scenarios**:

1. **Given** a server owner, **When** they request an invite link, **Then** a link is generated that can be shared with others.
2. **Given** a valid invite link, **When** a logged-in user opens it, **Then** they become a member of that server and can see its channels.
3. **Given** a server with multiple members, **When** any member views the server, **Then** they see a sidebar listing all members and each one's online/offline status.

---

### User Story 4 - Message Lifecycle: Edit, Delete, Typing, History (Priority: P2)

Members can fix typos by editing their own messages (marked as edited), remove messages they no longer want visible, see a typing indicator when someone else is composing a message, and scroll up to load older messages beyond what initially loaded.

**Why this priority**: These are expected refinements of the core chat experience (Story 2) but the platform is usable for real conversations without them first.

**Independent Test**: Can be fully tested by sending several messages, editing one and confirming an "edited" marker appears, deleting another and confirming it disappears for all viewers, watching for a typing indicator while another member composes, and scrolling to the top of a channel with more history than initially loaded to confirm older messages appear.

**Acceptance Scenarios**:

1. **Given** a message the current user authored, **When** they edit its content, **Then** the message updates for all members and is marked as edited.
2. **Given** a message the current user authored, **When** they delete it, **Then** it no longer appears for any member.
3. **Given** a member composing a message, **When** they are typing, **Then** other members currently viewing the channel see a typing indicator for that member.
4. **Given** a channel with more history than is initially loaded, **When** a member scrolls to the top of the loaded messages, **Then** older messages load automatically, continuing to show newest-first order overall.
5. **Given** a message authored by another member, **When** the current user views it, **Then** no edit or delete controls are available to them for that message.

---

### User Story 5 - Channel Management (Priority: P2)

The server owner organizes the server by creating additional text and voice channels, renaming channels, and deleting channels that are no longer needed. All members can see every channel in the server.

**Why this priority**: Useful for organizing a growing community, but a server with just the default channel (Story 2) is already usable.

**Independent Test**: Can be fully tested by having the owner create a new text channel and a voice channel, rename one, delete another, and confirming all members immediately see the updated channel list and that a deleted channel's messages are gone.

**Acceptance Scenarios**:

1. **Given** a server owner, **When** they create a new text or voice channel, **Then** it appears in the channel list for every member.
2. **Given** an existing channel, **When** the owner renames it, **Then** the new name is visible to all members.
3. **Given** an existing channel with messages, **When** the owner deletes it, **Then** the channel and all of its messages are permanently removed for every member.
4. **Given** a non-owner member, **When** they view the server, **Then** they cannot create, rename, or delete channels.

---

### User Story 6 - Direct Messages (Priority: P2)

Any user can start a private 1-on-1 conversation with another member they share a server with. The conversation behaves like a channel: messages appear in real time and can be edited or deleted by their author.

**Why this priority**: Extends the platform's real-time messaging (Story 2/4) to private conversations; valuable but not required for the first usable community experience.

**Independent Test**: Can be fully tested by having two users who share a server open a DM with each other, exchange messages in real time, and edit/delete a message, confirming the same behavior as a text channel.

**Acceptance Scenarios**:

1. **Given** two users who share at least one server, **When** one opens a DM with the other, **Then** a private 1-on-1 conversation is created (or the existing one is reopened).
2. **Given** an open DM conversation, **When** one participant sends a message, **Then** the other sees it appear in real time.
3. **Given** a message the current user authored in a DM, **When** they edit or delete it, **Then** the change is reflected for both participants, consistent with channel message behavior.

---

### User Story 7 - Voice & Video Calls (Priority: P2)

A member joins a voice channel and enters a live call with whoever else is currently in that channel. Participants can toggle their microphone and camera, see video tiles for each participant, see who is speaking or muted, and leave the call at any time. The channel list shows who is currently connected to each voice channel. A 1-on-1 video call can also be started directly from a DM.

**Why this priority**: Voice/video is a major differentiator of the product but depends on servers, channels, and membership already existing; it is delivered after the core text experience is solid.

**Independent Test**: Can be fully tested by having two members join the same voice channel, confirming both see and hear each other, toggling mic/camera and observing the change reflected for the other participant, confirming the channel list shows both as connected, and then starting a 1-on-1 video call from a DM between two users.

**Acceptance Scenarios**:

1. **Given** a voice channel with at least one member already connected, **When** another member joins it, **Then** they enter the same live call and both can see/hear each other.
2. **Given** a participant in a call, **When** they toggle their microphone or camera, **Then** other participants immediately see the updated mute/video state, and the participant's own video tile stops/starts sending video accordingly.
3. **Given** a participant speaking in a call, **When** other participants view the call, **Then** they see an indicator showing who is currently speaking.
4. **Given** a member viewing the channel list, **When** one or more members are connected to a voice channel, **Then** the channel list shows who is currently connected to that channel.
5. **Given** a participant in a call, **When** they choose to leave, **Then** they exit the call and other participants see them removed from the connected list immediately.
6. **Given** a DM between two users, **When** one starts a video call from the DM, **Then** the other is invited into a live 1-on-1 video call.
7. **Given** a voice channel already at the maximum of 4 connected participants, **When** a fifth member attempts to join, **Then** they are informed the channel is full and are not connected to the call.

---

### User Story 8 - Server Administration (Priority: P3)

The server owner keeps the community in order by renaming the server and removing members who should no longer have access.

**Why this priority**: Housekeeping capability that matters as a server matures, but the server is fully usable without it from day one.

**Independent Test**: Can be fully tested by having the owner rename an existing server and remove a member, confirming the new name is visible to all members and the removed member no longer has access to the server.

**Acceptance Scenarios**:

1. **Given** a server owner, **When** they rename the server, **Then** all members see the updated name.
2. **Given** a server owner, **When** they remove a member from the server, **Then** that member immediately loses access to the server's channels and calls.
3. **Given** a non-owner member, **When** they view server settings, **Then** they cannot rename the server or remove other members.

---

### Edge Cases

- What happens when the owner deletes a voice channel that currently has an active call? All participants are immediately disconnected and the call ends.
- What happens when a member tries to open a DM with someone they no longer share any server with? Existing DM conversations remain accessible to both participants regardless of continued shared server membership; a new DM can only be started with a current shared-server member.
- What happens when the last remaining voice-channel participant leaves? The call ends; the channel returns to an empty/idle state ready for the next member to start it again.
- What happens when a removed member tries to use a link or view they had open for the server they were removed from? They immediately lose access and any further action in that server is rejected.
- How does the system handle two members editing/deleting the same message at nearly the same time? Only the message's author can edit or delete it, so this conflict cannot occur between different members; the author's own concurrent actions resolve to the last one applied.
- What happens when a user loses network connectivity mid-call? They are shown as disconnected/removed from the call for other participants after a brief timeout, and can rejoin the voice channel once reconnected.
- What happens to typing indicators when a member stops typing without sending a message? The indicator clears automatically after a short pause in activity.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a person to sign up with a display name, and MUST support subsequent logins to the same account.
- **FR-002**: System MUST allow a user to set/change an avatar image for their account.
- **FR-003**: System MUST track and display each user's online/offline status to other users, updating it when they log in, log out, or their session ends.
- **FR-004**: System MUST allow a logged-in user to create a server with a name and an optional image, making that user the server's owner.
- **FR-005**: System MUST automatically create a default text channel named "general" whenever a new server is created.
- **FR-006**: System MUST allow the server owner to generate an invite link that grants access to join the server.
- **FR-007**: System MUST allow any logged-in user who has a valid invite link to join the corresponding server as a member.
- **FR-008**: System MUST display, for each server, a sidebar listing its members and each member's current online/offline status.
- **FR-009**: System MUST allow the server owner to rename the server.
- **FR-010**: System MUST allow the server owner to remove a member from the server, immediately revoking that member's access.
- **FR-011**: System MUST allow every member to see the full list of text and voice channels in a server they belong to.
- **FR-012**: System MUST allow the server owner to create, rename, and delete text channels and voice channels.
- **FR-013**: System MUST permanently remove a channel's messages when that channel is deleted.
- **FR-014**: System MUST allow a member to send a text message in a text channel they can access.
- **FR-015**: System MUST deliver new messages to all members currently viewing a channel in real time, without requiring a manual page refresh.
- **FR-016**: System MUST display, for each message, the author's display name, avatar, timestamp, and content.
- **FR-017**: System MUST allow a message's author to edit its content, and MUST visibly mark edited messages as edited.
- **FR-018**: System MUST allow a message's author to delete their own message, removing it from the channel for all members.
- **FR-019**: System MUST prevent members from editing or deleting messages they did not author.
- **FR-020**: System MUST load channel messages newest-first and support loading progressively older history as the member scrolls back, without requiring a full page reload.
- **FR-021**: System MUST show other members a typing indicator when a member is actively composing a message in a channel they are viewing.
- **FR-022**: System MUST allow a user to open a private 1-on-1 direct message conversation with another user, provided both currently share at least one server.
- **FR-023**: System MUST apply the same real-time delivery, author-only edit, and author-only delete behavior to direct messages as to channel messages.
- **FR-024**: System MUST allow a member to join a voice channel, connecting them to a live call with whichever other members are currently connected to that same channel.
- **FR-025**: System MUST support at least 2 and up to 4 simultaneous participants in a single voice channel call, and MUST prevent additional joins once the maximum is reached.
- **FR-026**: System MUST allow a call participant to independently toggle their own microphone and camera on or off.
- **FR-027**: System MUST show each participant a live video tile for every other participant who has their camera on.
- **FR-028**: System MUST indicate to all participants which participant(s) are currently speaking and which are muted.
- **FR-029**: System MUST allow a participant to leave a call at any time, and MUST reflect their departure to remaining participants immediately.
- **FR-030**: System MUST show, in the channel list, which members are currently connected to each voice channel.
- **FR-031**: System MUST allow a user to start a 1-on-1 video call directly from a DM conversation with another user.
- **FR-032**: System MUST restrict server, channel-management, member-removal, and server-rename actions to the server's owner; all other members MUST be limited to member-level actions (viewing, messaging, joining channels/calls).

### Key Entities

- **User**: A person with an account; has a display name, an avatar, credentials, and an online/offline status visible to others.
- **Server**: A named community, optionally with an image, created and owned by one user; contains channels and members.
- **Membership**: The relationship between a user and a server they belong to, including whether that user is the server's owner.
- **Invite**: A shareable link tied to a server that grants a user membership in that server when opened.
- **Channel**: A named space within a server, either a text channel (holds messages) or a voice channel (holds a live call); every server starts with one default text channel named "general."
- **Message**: A piece of content authored by a user within a text channel or a DM conversation; has content, a timestamp, an author, and an edited flag.
- **Direct Message Conversation**: A private 1-on-1 conversation between two users who share (or shared) at least one server, containing its own messages.
- **Call**: A live voice/video session tied to a voice channel or a DM, with a set of currently connected participants, each with their own mute/camera state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can sign up and send their first message in a server within 2 minutes of landing on the app.
- **SC-002**: A message sent by one member becomes visible to other members actively viewing the same channel within 1 second, without any manual refresh.
- **SC-003**: A person who receives an invite link can join the server and see its channels within 30 seconds of opening the link.
- **SC-004**: Online/offline status changes are reflected to other users within 5 seconds of the change occurring.
- **SC-005**: Members can load older message history via scrolling with no more than a brief, unobtrusive delay per page of history (perceived as instant by users in informal testing).
- **SC-006**: Two to four participants can be simultaneously connected to a voice channel call with working audio, video, mute, and camera toggling for the full duration of the call.
- **SC-007**: 90% of first-time users can, without external help, find and start a direct message with someone they share a server with.
- **SC-008**: Channel and server management changes (create/rename/delete channel, rename server, remove member) made by an owner are visible to all other members within 5 seconds.

## Assumptions

- Authentication is standard credential-based sign-up/login (e.g., display name plus a password or equivalent credential); no third-party single-sign-on is required for v1.
- Invite links are reusable and do not expire on their own; the owner can generate a new link at any time, but explicit link revocation/expiration management is not required for v1.
- Removing a member from a server does not ban them from it; since roles/permissions beyond owner vs. member are out of scope, there is no ban list, so a removed member could rejoin later via a valid invite link.
- A voice channel call enforces a hard cap of 4 simultaneous participants; a member attempting to join a full call is blocked with a "channel full" style message rather than being queued.
- Deleting a message removes it entirely from the channel view for all members; no "message deleted" placeholder is shown.
- An edited message displays a visible "(edited)" indicator near its timestamp.
- Direct message conversations, once created, remain accessible to both participants even if they later stop sharing any server.
- Each server has exactly one owner (its creator) for v1; ownership transfer and server deletion are not required.
- New users provide a display name at sign-up; if no avatar is uploaded, a default avatar is assigned automatically.
- Typing indicators are ephemeral (not stored as history) and clear automatically shortly after typing activity stops or a message is sent.
