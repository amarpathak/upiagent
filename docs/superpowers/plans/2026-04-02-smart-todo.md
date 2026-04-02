# Smart Todo App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal personal todo app at `apps/todo` with AI-powered task expansion using the local OpenClaw Claude proxy.

**Architecture:** Next.js 16 App Router app isolated in the monorepo. Auth via signed session cookie + single password env var. Turso SQLite for storage. Vercel AI SDK with OpenAI-compatible provider hitting `http://localhost:3456/v1` for AI expansion.

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS v4, Turso (`@libsql/client`), Vercel AI SDK (`ai` + `@ai-sdk/openai`), `jose` (JWT cookie signing), `ulid`

---

## IMPORTANT: Isolation Notice

`apps/todo` is a **standalone personal productivity app**, completely unrelated to the UPI payment gateway in `apps/www` and `apps/dashboard`. Do not import from or depend on other apps in this monorepo.

---

## File Map

```
apps/todo/
├── package.json
├── next.config.ts
├── tsconfig.json
├── .env.local.example
├── components.json                    # shadcn config
├── src/
│   ├── middleware.ts                  # auth cookie check, redirects to /login
│   ├── lib/
│   │   ├── db.ts                      # Turso client singleton + schema init
│   │   ├── auth.ts                    # sign/verify session cookie with jose
│   │   └── ulid.ts                    # tiny ulid generator wrapper
│   ├── app/
│   │   ├── layout.tsx                 # root layout, dark mode, fonts
│   │   ├── login/
│   │   │   └── page.tsx               # password form
│   │   ├── profile/
│   │   │   └── page.tsx               # user facts CRUD
│   │   ├── page.tsx                   # main todo view
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts     # POST: verify password, set cookie
│   │       │   └── logout/route.ts    # POST: clear cookie
│   │       ├── todos/
│   │       │   ├── route.ts           # GET: list, POST: create
│   │       │   └── [id]/
│   │       │       ├── route.ts       # PATCH: update (status/subtasks), DELETE
│   │       │       └── expand/
│   │       │           └── route.ts   # POST: AI expand
│   │       └── facts/
│   │           ├── route.ts           # GET: list, POST: create
│   │           └── [id]/
│   │               └── route.ts       # DELETE
│   └── components/
│       ├── todo-input.tsx             # controlled input, Enter to submit
│       ├── todo-item.tsx              # checkbox, sparkle, trash
│       ├── todo-list.tsx              # splits open/done, renders todo-item
│       ├── expand-panel.tsx           # slide-in panel, subtask checkboxes, question
│       └── fact-item.tsx              # key-value row with delete button
```

---

## Task 1: Scaffold the app

**Files:**
- Create: `apps/todo/package.json`
- Create: `apps/todo/tsconfig.json`
- Create: `apps/todo/next.config.ts`
- Create: `apps/todo/.env.local.example`

- [ ] **Step 1: Create `apps/todo/package.json`**

```json
{
  "name": "todo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start --port 3002",
    "lint": "eslint"
  },
  "dependencies": {
    "@ai-sdk/openai": "^1.3.22",
    "@libsql/client": "^0.14.0",
    "ai": "^4.3.16",
    "jose": "^5.9.6",
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "ulid": "^2.3.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `apps/todo/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/todo/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/todo/.env.local.example`**

```
TODO_PASSWORD=changeme
AUTH_SECRET=generate-a-random-32-char-string-here
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token
OPENCLAW_BASE_URL=http://localhost:3456/v1
```

- [ ] **Step 5: Install dependencies**

```bash
cd apps/todo && yarn install
```

- [ ] **Step 6: Commit**

```bash
git add apps/todo/package.json apps/todo/tsconfig.json apps/todo/next.config.ts apps/todo/.env.local.example
git commit -m "feat(todo): scaffold Next.js app"
```

---

## Task 2: Database client + schema

**Files:**
- Create: `apps/todo/src/lib/db.ts`
- Create: `apps/todo/src/lib/ulid.ts`

- [ ] **Step 1: Create `apps/todo/src/lib/ulid.ts`**

```ts
import { ulid as generate } from "ulid";

export function ulid(): string {
  return generate();
}
```

- [ ] **Step 2: Create `apps/todo/src/lib/db.ts`**

```ts
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) throw new Error("TURSO_DATABASE_URL is not set");

export const db = createClient({ url, authToken });

export async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      subtasks TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      expanded_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS user_facts (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      observation TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  ]);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/todo/src/lib/db.ts apps/todo/src/lib/ulid.ts
git commit -m "feat(todo): add Turso db client and schema init"
```

---

## Task 3: Auth utilities

**Files:**
- Create: `apps/todo/src/lib/auth.ts`

- [ ] **Step 1: Create `apps/todo/src/lib/auth.ts`**

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "fallback-dev-secret-change-in-prod"
);

export async function signSession(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/todo/src/lib/auth.ts
git commit -m "feat(todo): add session cookie auth utilities"
```

---

## Task 4: Middleware (route protection)

**Files:**
- Create: `apps/todo/src/middleware.ts`

- [ ] **Step 1: Create `apps/todo/src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "fallback-dev-secret-change-in-prod"
);

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/todo/src/middleware.ts
git commit -m "feat(todo): add auth middleware"
```

---

## Task 5: Auth API routes

**Files:**
- Create: `apps/todo/src/app/api/auth/login/route.ts`
- Create: `apps/todo/src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Create `apps/todo/src/app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { signSession } from "@/lib/auth";
import { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== process.env.TODO_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await initDb();

  const token = await signSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
```

- [ ] **Step 2: Create `apps/todo/src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("session");
  return res;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/todo/src/app/api/auth/login/route.ts apps/todo/src/app/api/auth/logout/route.ts
git commit -m "feat(todo): add auth API routes"
```

---

## Task 6: Todos API routes

**Files:**
- Create: `apps/todo/src/app/api/todos/route.ts`
- Create: `apps/todo/src/app/api/todos/[id]/route.ts`

- [ ] **Step 1: Create `apps/todo/src/app/api/todos/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ulid } from "@/lib/ulid";

export async function GET() {
  const result = await db.execute("SELECT * FROM todos ORDER BY created_at DESC");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const id = ulid();
  const now = Date.now();

  await db.execute({
    sql: "INSERT INTO todos (id, text, status, subtasks, created_at) VALUES (?, ?, 'open', '[]', ?)",
    args: [id, text.trim(), now],
  });

  const row = await db.execute({ sql: "SELECT * FROM todos WHERE id = ?", args: [id] });
  return NextResponse.json(row.rows[0], { status: 201 });
}
```

- [ ] **Step 2: Create `apps/todo/src/app/api/todos/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const updates: string[] = [];
  const args: unknown[] = [];

  if (body.status !== undefined) {
    updates.push("status = ?");
    args.push(body.status);
  }
  if (body.subtasks !== undefined) {
    updates.push("subtasks = ?");
    args.push(JSON.stringify(body.subtasks));
  }
  if (body.expanded_at !== undefined) {
    updates.push("expanded_at = ?");
    args.push(body.expanded_at);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  args.push(id);
  await db.execute({ sql: `UPDATE todos SET ${updates.join(", ")} WHERE id = ?`, args });

  const row = await db.execute({ sql: "SELECT * FROM todos WHERE id = ?", args: [id] });
  if (row.rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(row.rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM todos WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/todo/src/app/api/todos/route.ts apps/todo/src/app/api/todos/[id]/route.ts
git commit -m "feat(todo): add todos CRUD API routes"
```

---

## Task 7: Facts API routes

**Files:**
- Create: `apps/todo/src/app/api/facts/route.ts`
- Create: `apps/todo/src/app/api/facts/[id]/route.ts`

- [ ] **Step 1: Create `apps/todo/src/app/api/facts/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ulid } from "@/lib/ulid";

export async function GET() {
  const result = await db.execute("SELECT * FROM user_facts ORDER BY created_at ASC");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const { key, value } = await req.json();

  if (!key?.trim() || !value?.trim()) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const id = ulid();
  const now = Date.now();

  await db.execute({
    sql: "INSERT INTO user_facts (id, key, value, created_at) VALUES (?, ?, ?, ?)",
    args: [id, key.trim(), value.trim(), now],
  });

  const row = await db.execute({ sql: "SELECT * FROM user_facts WHERE id = ?", args: [id] });
  return NextResponse.json(row.rows[0], { status: 201 });
}
```

- [ ] **Step 2: Create `apps/todo/src/app/api/facts/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM user_facts WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/todo/src/app/api/facts/route.ts apps/todo/src/app/api/facts/[id]/route.ts
git commit -m "feat(todo): add user facts API routes"
```

---

## Task 8: AI expand route

**Files:**
- Create: `apps/todo/src/app/api/todos/[id]/expand/route.ts`

- [ ] **Step 1: Create `apps/todo/src/app/api/todos/[id]/expand/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const openai = createOpenAI({
  baseURL: process.env.OPENCLAW_BASE_URL ?? "http://localhost:3456/v1",
  apiKey: "not-needed",
});

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const todoResult = await db.execute({
    sql: "SELECT * FROM todos WHERE id = ?",
    args: [id],
  });

  if (todoResult.rows.length === 0) {
    return NextResponse.json({ error: "todo not found" }, { status: 404 });
  }

  const todo = todoResult.rows[0];

  const factsResult = await db.execute(
    "SELECT key, value FROM user_facts ORDER BY created_at ASC"
  );
  const patternsResult = await db.execute(
    "SELECT observation FROM patterns ORDER BY created_at DESC LIMIT 10"
  );

  const factsText = factsResult.rows
    .map((r) => `${r.key}: ${r.value}`)
    .join("\n");

  const patternsText = patternsResult.rows
    .map((r) => `- ${r.observation}`)
    .join("\n");

  const systemPrompt = `You are a smart personal assistant that knows this user well.

User facts:
${factsText || "(none yet)"}

Observed patterns:
${patternsText || "(none yet)"}

Return ONLY valid JSON in this exact shape, no markdown, no explanation:
{"subtasks":["string","string","string"],"question":"string"}`;

  const userPrompt = `Todo: "${todo.text}"

Provide 3-5 concrete subtasks to complete this todo, and one clarifying question that would make it more actionable.`;

  const { text } = await generateText({
    model: openai("claude-sonnet-4"),
    system: systemPrompt,
    prompt: userPrompt,
  });

  let parsed: { subtasks: string[]; question: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("AI returned invalid JSON:", text);
    return NextResponse.json({ error: "AI returned invalid response" }, { status: 502 });
  }

  // Update expanded_at
  await db.execute({
    sql: "UPDATE todos SET expanded_at = ? WHERE id = ?",
    args: [Date.now(), id],
  });

  return NextResponse.json(parsed);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/todo/src/app/api/todos/[id]/expand/route.ts
git commit -m "feat(todo): add AI expand API route"
```

---

## Task 9: Root layout + global styles

**Files:**
- Create: `apps/todo/src/app/layout.tsx`
- Create: `apps/todo/src/app/globals.css`

- [ ] **Step 1: Install shadcn/ui**

```bash
cd apps/todo && npx shadcn@latest init -d
```

When prompted, choose: dark theme, default style, `src/` directory. This creates `components.json` and installs Tailwind + shadcn config.

- [ ] **Step 2: Add required shadcn components**

```bash
cd apps/todo && npx shadcn@latest add button input checkbox
```

- [ ] **Step 3: Create `apps/todo/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Todo",
  description: "Personal smart todo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/todo/src/app/layout.tsx apps/todo/src/app/globals.css apps/todo/components.json
git commit -m "feat(todo): add root layout and shadcn setup"
```

---

## Task 10: Login page

**Files:**
- Create: `apps/todo/src/app/login/page.tsx`

- [ ] **Step 1: Create `apps/todo/src/app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Wrong password");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm px-6">
        <h1 className="text-xl font-semibold tracking-tight">Todo</h1>
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/todo/src/app/login/page.tsx
git commit -m "feat(todo): add login page"
```

---

## Task 11: Todo components

**Files:**
- Create: `apps/todo/src/components/todo-input.tsx`
- Create: `apps/todo/src/components/todo-item.tsx`
- Create: `apps/todo/src/components/todo-list.tsx`

- [ ] **Step 1: Create `apps/todo/src/components/todo-input.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface TodoInputProps {
  onAdd: (text: string) => void;
}

export function TodoInput({ onAdd }: TodoInputProps) {
  const [value, setValue] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  }

  return (
    <Input
      placeholder="Add a todo… (press Enter)"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className="w-full"
      autoFocus
    />
  );
}
```

- [ ] **Step 2: Create `apps/todo/src/components/todo-item.tsx`**

```tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Sparkles, Trash2 } from "lucide-react";

export interface Todo {
  id: string;
  text: string;
  status: string;
  subtasks: string; // JSON string
  created_at: number;
  expanded_at: number | null;
}

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onExpand: (id: string) => void;
}

export function TodoItem({ todo, onToggle, onDelete, onExpand }: TodoItemProps) {
  const done = todo.status === "done";

  return (
    <div className={`flex items-center gap-3 py-2 group ${done ? "opacity-40" : ""}`}>
      <Checkbox
        checked={done}
        onCheckedChange={(checked) => onToggle(todo.id, !!checked)}
      />
      <span className={`flex-1 text-sm ${done ? "line-through" : ""}`}>{todo.text}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onExpand(todo.id)}
          title="Expand with AI"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(todo.id)}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Install lucide-react**

```bash
cd apps/todo && yarn add lucide-react
```

- [ ] **Step 4: Create `apps/todo/src/components/todo-list.tsx`**

```tsx
"use client";

import { TodoItem, type Todo } from "./todo-item";

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onExpand: (id: string) => void;
}

export function TodoList({ todos, onToggle, onDelete, onExpand }: TodoListProps) {
  const open = todos.filter((t) => t.status === "open");
  const done = todos.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col divide-y divide-border">
      {open.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} onExpand={onExpand} />
      ))}
      {done.length > 0 && (
        <>
          <div className="py-2 text-xs text-muted-foreground font-mono tracking-widest uppercase mt-2">Completed</div>
          {done.map((todo) => (
            <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} onExpand={onExpand} />
          ))}
        </>
      )}
      {todos.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">No todos yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/todo/src/components/todo-input.tsx apps/todo/src/components/todo-item.tsx apps/todo/src/components/todo-list.tsx
git commit -m "feat(todo): add todo UI components"
```

---

## Task 12: Expand panel component

**Files:**
- Create: `apps/todo/src/components/expand-panel.tsx`

- [ ] **Step 1: Create `apps/todo/src/components/expand-panel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import type { Todo } from "./todo-item";

interface ExpandResult {
  subtasks: string[];
  question: string;
}

interface ExpandPanelProps {
  todo: Todo;
  onClose: () => void;
  onSave: (todoId: string, subtasks: string[]) => void;
}

export function ExpandPanel({ todo, onClose, onSave }: ExpandPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExpandResult | null>(null);
  const [accepted, setAccepted] = useState<boolean[]>([]);

  async function runExpand() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/todos/${todo.id}/expand`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Expand failed");
      }
      const data: ExpandResult = await res.json();
      setResult(data);
      setAccepted(new Array(data.subtasks.length).fill(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Auto-trigger on mount
  useState(() => { runExpand(); });

  function handleSave() {
    if (!result) return;
    const chosen = result.subtasks.filter((_, i) => accepted[i]);
    onSave(todo.id, chosen);
    onClose();
  }

  return (
    <div className="flex flex-col h-full border-l border-border bg-card p-5 gap-4 w-full max-w-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">Expanding</p>
          <p className="text-sm font-medium">{todo.text}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Thinking…</p>}

      {error && (
        <div className="text-sm text-destructive">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={runExpand}>Retry</Button>
        </div>
      )}

      {result && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Subtasks</p>
            {result.subtasks.map((sub, i) => (
              <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={accepted[i]}
                  onCheckedChange={(checked) => {
                    const next = [...accepted];
                    next[i] = !!checked;
                    setAccepted(next);
                  }}
                />
                {sub}
              </label>
            ))}
          </div>

          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">Question</p>
            <p className="text-sm">{result.question}</p>
          </div>

          <div className="flex gap-2 mt-auto">
            <Button onClick={handleSave} className="flex-1">Save subtasks</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/todo/src/components/expand-panel.tsx
git commit -m "feat(todo): add AI expand panel component"
```

---

## Task 13: Main todo page

**Files:**
- Create: `apps/todo/src/app/page.tsx`

- [ ] **Step 1: Create `apps/todo/src/app/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { TodoInput } from "@/components/todo-input";
import { TodoList } from "@/components/todo-list";
import { ExpandPanel } from "@/components/expand-panel";
import type { Todo } from "@/components/todo-item";

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [expandingId, setExpandingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/todos")
      .then((r) => r.json())
      .then(setTodos);
  }, []);

  async function handleAdd(text: string) {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const todo: Todo = await res.json();
    setTodos((prev) => [todo, ...prev]);
  }

  async function handleToggle(id: string, done: boolean) {
    const status = done ? "done" : "open";
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated: Todo = await res.json();
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSaveSubtasks(todoId: string, subtasks: string[]) {
    const res = await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtasks: subtasks.map((text) => ({ text, done: false })) }),
    });
    const updated: Todo = await res.json();
    setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
  }

  const expandingTodo = todos.find((t) => t.id === expandingId) ?? null;

  return (
    <div className="flex h-screen">
      <div className="flex flex-col flex-1 max-w-xl mx-auto px-6 py-8 gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Todo</h1>
          <a href="/profile" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Profile
          </a>
        </div>
        <TodoInput onAdd={handleAdd} />
        <TodoList
          todos={todos}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onExpand={setExpandingId}
        />
      </div>

      {expandingTodo && (
        <ExpandPanel
          todo={expandingTodo}
          onClose={() => setExpandingId(null)}
          onSave={handleSaveSubtasks}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/todo/src/app/page.tsx
git commit -m "feat(todo): add main todo page"
```

---

## Task 14: Profile page (user facts)

**Files:**
- Create: `apps/todo/src/components/fact-item.tsx`
- Create: `apps/todo/src/app/profile/page.tsx`

- [ ] **Step 1: Create `apps/todo/src/components/fact-item.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface Fact {
  id: string;
  key: string;
  value: string;
}

interface FactItemProps {
  fact: Fact;
  onDelete: (id: string) => void;
}

export function FactItem({ fact, onDelete }: FactItemProps) {
  return (
    <div className="flex items-center gap-3 py-2 group">
      <span className="text-xs font-mono text-muted-foreground w-28 shrink-0 truncate">{fact.key}</span>
      <span className="flex-1 text-sm truncate">{fact.value}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={() => onDelete(fact.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/todo/src/app/profile/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { FactItem, type Fact } from "@/components/fact-item";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/facts")
      .then((r) => r.json())
      .then(setFacts);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!key.trim() || !value.trim()) {
      setError("Both key and value are required");
      return;
    }
    const res = await fetch("/api/facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      setError("Failed to add fact");
      return;
    }
    const fact: Fact = await res.json();
    setFacts((prev) => [...prev, fact]);
    setKey("");
    setValue("");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/facts/${id}`, { method: "DELETE" });
    setFacts((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Profile</h1>
        <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back
        </a>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Facts you tell me — I use these when expanding your todos.
      </p>

      <div className="flex flex-col divide-y divide-border mb-8">
        {facts.map((fact) => (
          <FactItem key={fact.id} fact={fact} onDelete={handleDelete} />
        ))}
        {facts.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No facts yet.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Add a fact</p>
        <div className="flex gap-2">
          <Input
            placeholder="key (e.g. role)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-36"
          />
          <Input
            placeholder="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Add</Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/todo/src/components/fact-item.tsx apps/todo/src/app/profile/page.tsx
git commit -m "feat(todo): add profile page for user facts"
```

---

## Task 15: Wire up turbo + smoke test

**Files:**
- Modify: `apps/todo/.env.local` (create from example, not committed)

- [ ] **Step 1: Copy env file and fill in values**

```bash
cp apps/todo/.env.local.example apps/todo/.env.local
```

Edit `apps/todo/.env.local`:
- `TODO_PASSWORD` — pick any password
- `AUTH_SECRET` — run `openssl rand -base64 32` and paste result
- `TURSO_DATABASE_URL` — create a free DB at turso.tech, paste the libsql URL
- `TURSO_AUTH_TOKEN` — paste the auth token from Turso dashboard
- `OPENCLAW_BASE_URL` — leave as `http://localhost:3456/v1`

- [ ] **Step 2: Start the OpenClaw proxy**

```bash
npm install -g claude-max-api-proxy
claude-max-api
```

Expected: `Proxy running on http://localhost:3456`

- [ ] **Step 3: Start the app**

```bash
cd apps/todo && yarn dev
```

Expected: `▲ Next.js 16.x.x - Local: http://localhost:3002`

- [ ] **Step 4: Smoke test**

1. Open `http://localhost:3002` — should redirect to `/login`
2. Enter your `TODO_PASSWORD` — should redirect to `/`
3. Add a todo — should appear in the list
4. Check it done — should move to completed section
5. Click sparkle — panel should open, Claude should respond with subtasks + question
6. Save subtasks — panel closes
7. Visit `/profile`, add a fact (e.g. key: `role`, value: `frontend engineer`)
8. Expand another todo — the AI response should reflect your profile

- [ ] **Step 5: Final commit**

```bash
git add apps/todo/.env.local.example
git commit -m "feat(todo): complete smart todo app MVP"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Isolated Next.js app at `apps/todo`
- ✅ Auth: `TODO_PASSWORD` + `AUTH_SECRET`, session cookie, middleware
- ✅ Turso: `todos`, `user_facts`, `patterns` tables
- ✅ CRUD: todos (create, toggle, delete, subtask save) + facts (create, delete)
- ✅ AI expand: OpenClaw proxy, user_facts + patterns context, subtasks + question
- ✅ UI: login, main todo view, expand panel, profile page
- ✅ Dark mode, shadcn/ui
- ✅ Patterns table created (not populated — out of scope)

**Placeholder scan:** None found.

**Type consistency:** `Todo` interface defined in `todo-item.tsx` and imported in `todo-list.tsx`, `expand-panel.tsx`, `page.tsx`. `Fact` interface defined in `fact-item.tsx` and imported in `profile/page.tsx`. Consistent throughout.
