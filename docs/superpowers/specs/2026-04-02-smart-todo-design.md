# Smart Todo App — Design Spec

**Date:** 2026-04-02
**Status:** Approved

---

## Isolation Notice

`apps/todo` is a **standalone personal productivity app** — entirely unrelated to the UPI payment gateway work in `apps/www` and `apps/dashboard`. It shares the monorepo for convenience only. Agents and tooling should treat it as a separate project with no domain overlap.

---

## Overview

A minimal, AI-powered personal todo app for a single user. The AI knows facts about the user (explicitly stored) and learns from usage patterns over time. The first feature is core todo management + AI-powered task expansion.

---

## Architecture

- **Framework:** Next.js App Router (`apps/todo`)
- **UI:** shadcn/ui, dark mode, Tailwind CSS
- **Storage:** Turso (serverless SQLite)
- **AI:** Vercel AI SDK with OpenAI-compatible provider pointed at OpenClaw proxy (`http://localhost:3456/v1`) — uses local Claude Max session, no API key required
- **Auth:** Single-user password auth via `TODO_PASSWORD` env var, session cookie

---

## Data Model

### `todos`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text (ulid) | primary key |
| `text` | text | the todo as entered |
| `status` | text | `open` or `done` |
| `subtasks` | text (JSON) | array of `{ text, done }` objects |
| `created_at` | integer | unix timestamp |
| `expanded_at` | integer | nullable, when AI expansion was last run |

### `user_facts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text (ulid) | primary key |
| `key` | text | e.g. `"role"`, `"wake_time"` |
| `value` | text | e.g. `"frontend engineer learning LLMs"` |
| `created_at` | integer | unix timestamp |

### `patterns`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text (ulid) | primary key |
| `observation` | text | e.g. `"completes tasks in the evening"` |
| `created_at` | integer | unix timestamp |

Patterns table is created now but populated in a future iteration.

---

## Auth

- `TODO_PASSWORD` env var holds the single password
- `POST /api/auth/login` — verifies password, sets `session` cookie (httpOnly, signed with `AUTH_SECRET` env var)
- `POST /api/auth/logout` — clears cookie
- Middleware checks `session` cookie on all routes except `/login` and `/api/auth/*`; redirects to `/login` if missing/invalid

---

## UI

### `/` — Main todo view (two-panel layout)

**Left / primary panel:**
- Text input at the top — type a todo, press Enter to add
- Todo list below:
  - Checkbox (mark done) — completed todos move to bottom, reduced opacity
  - Todo text
  - Sparkle button (✦) — triggers AI expansion
  - Trash button — deletes todo
- Completed todos are visually separated (faded, below a divider)

**Right / expansion panel (slides in on sparkle click):**
- Header: "Expanding: [todo text]"
- Suggested subtasks — each with a checkbox to accept/reject
- One clarifying question from Claude
- "Save" button — writes accepted subtasks to the todo record
- "Cancel" button — closes panel without saving

### `/profile` — User facts editor

- List of current key-value facts
- "Add fact" form: key input + value input + save button
- Delete button per fact
- No fancy UI — functional settings page

### `/login`

- Password field + submit button
- Redirects to `/` on success

---

## AI Expansion Flow

When the user clicks sparkle on a todo:

1. Client calls `POST /api/todos/[id]/expand`
2. Server loads all `user_facts` + last 10 `patterns` from DB
3. Sends to Claude via OpenClaw proxy with a system prompt:
   - "You are a smart assistant that knows this user. Facts: [user_facts]. Patterns: [patterns]."
   - "Given the todo '[text]', return: (1) a list of 3-5 subtasks, (2) one clarifying question to make it more actionable."
4. Response is structured JSON: `{ subtasks: string[], question: string }`
5. Returns to client, displayed in expansion panel

Model: `claude-sonnet-4` via `http://localhost:3456/v1`.

---

## Environment Variables

```
TODO_PASSWORD=       # login password
AUTH_SECRET=         # cookie signing secret (random string)
TURSO_DATABASE_URL=  # libsql://...
TURSO_AUTH_TOKEN=    # turso auth token
OPENCLAW_BASE_URL=   # http://localhost:3456/v1 (default, overridable)
```

---

## Out of Scope (this iteration)

- Pattern learning (table exists, not populated)
- Multiple users
- Mobile app
- Push notifications
- Recurring todos
- Due dates
