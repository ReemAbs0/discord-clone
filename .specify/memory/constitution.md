<!--
Sync Impact Report
- Version change: (unratified template) → 1.0.0
- Modified principles: n/a (initial ratification)
- Added principles:
  - I. Simplicity First
  - II. Real-Time Correctness
  - III. Type Safety End-to-End
  - IV. Security Basics (NON-NEGOTIABLE)
  - V. Incremental Delivery
  - VI. Testable Seams
- Added sections: Technology Constraints, Development Workflow, Governance
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (generic Constitution Check gate already compatible, no edit needed)
  - ✅ .specify/templates/spec-template.md (no constitution-specific references, no edit needed)
  - ✅ .specify/templates/tasks-template.md (no constitution-specific references, no edit needed)
  - ✅ .specify/templates/checklist-template.md (no constitution-specific references, no edit needed)
  - ✅ .claude/skills/speckit-*/SKILL.md (already reference constitution generically, no stale agent-specific names found)
- Follow-up TODOs: none
-->

# Discord Clone Constitution

## Core Principles

### I. Simplicity First
Prefer the smallest solution that satisfies the spec. No speculative
abstractions, no libraries beyond those already committed to in the current
plan. Every added dependency, abstraction layer, or generalized interface
MUST be justified by a concrete, current requirement, not a hypothetical
future one.

**Rationale**: As a student-built project, complexity accumulates faster
than it can be reasoned about. The smallest solution that works keeps the
codebase understandable and shippable by a small team.

### II. Real-Time Correctness
The UI MUST reflect server state via reactive subscriptions (e.g., live
queries or websockets), never via manual polling or requiring a page
refresh. Any view displaying data that can change on the server — messages,
presence, call state, typing indicators, etc. — MUST subscribe to updates
rather than fetch once and go stale.

**Rationale**: This is a real-time chat and video product; stale or
manually-refreshed state defeats its core value proposition.

### III. Type Safety End-to-End
TypeScript strict mode MUST be enabled across the entire codebase, frontend
and backend alike, with no unchecked `any` used to bypass the type system.
Database access MUST go only through typed schema definitions or generated
types — no untyped raw queries or ad-hoc object shapes crossing the
client/server boundary.

**Rationale**: End-to-end type safety catches an entire class of runtime
bugs before they ship, which matters most for a small team without a
dedicated QA process.

### IV. Security Basics (NON-NEGOTIABLE)
Every backend function MUST verify that the caller is authenticated and
authorized for the specific resource it touches before performing any read
or write. There is no implicit trust boundary: authorization checks MUST
run on the server, never solely in the client.

**Rationale**: Chat and video apps carry private messages and calls; a
single missing authorization check exposes another user's private data.

### V. Incremental Delivery
The application MUST build and run successfully after each user story is
completed. The main branch MUST never be left in a broken (non-building,
non-running) state. Work MUST be structured so that each user story is a
complete, demonstrable increment on its own.

**Rationale**: Keeps the project always in a demoable state and prevents
large, unverified batches of work from piling up before anyone can tell
whether they actually work.

### VI. Testable Seams
Business logic MUST be separated from UI/presentation code so it can be
tested without rendering components. Critical user flows — at minimum,
sending a message and joining a call — MUST have at least a smoke test
verifying they work end-to-end.

**Rationale**: Separating logic from UI keeps tests fast and meaningful;
smoke tests on critical flows catch regressions before users do, without
requiring full TDD ceremony on every change.

## Technology Constraints

- All new code MUST be written in TypeScript with `strict: true` enabled;
  no project-wide relaxation of strict mode is permitted.
- Real-time data MUST flow through the project's chosen reactive data layer
  (live queries/subscriptions), never through ad-hoc polling loops.
- No new runtime dependency may be introduced without first being recorded
  in the feature's `plan.md`; unplanned dependencies are a simplicity
  violation (Principle I).

## Development Workflow

- Every `plan.md` MUST include a Constitution Check section, evaluated
  before Phase 0 research and re-evaluated after Phase 1 design. Any
  unresolved violation MUST be recorded in Complexity Tracking with an
  explicit justification.
- A user story is not done until: it builds, it runs, its critical flow (if
  any) has a smoke test, and it does not regress any previously completed
  story.
- Commits or merges to the main branch MUST NOT leave the build broken. If
  a temporarily broken state is unavoidable mid-story, it MUST be resolved
  before starting the next story.

## Governance

This constitution supersedes all other project practices and conventions.
Amendments require a documented rationale, an explicit version bump per the
policy below, and propagation to any dependent templates (plan, spec,
tasks, checklists) before the amendment is considered complete.

Versioning policy:
- **MAJOR**: backward-incompatible governance change, or removal/redefinition
  of a principle.
- **MINOR**: a new principle or materially expanded guidance is added.
- **PATCH**: clarification or wording fix with no semantic change.

All plans and pull requests MUST verify compliance with these principles.
Unjustified complexity MUST be rejected or explicitly recorded in
Complexity Tracking with a rationale for why a simpler alternative was
insufficient.

**Version**: 1.0.0 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
