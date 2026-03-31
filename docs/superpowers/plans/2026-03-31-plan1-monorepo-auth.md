# Plan 1: Monorepo Setup + Supabase + Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the project into a Turborepo monorepo with `packages/core` (open-source npm package), `apps/www` (landing page), and `apps/dashboard` (SaaS app with Supabase auth).

**Architecture:** Turborepo monorepo. `packages/core` is the existing library moved as-is. `apps/www` is the existing landing page moved. `apps/dashboard` is a new Next.js 16 app with Supabase Auth (Google + email), shadcn/ui dark theme, and the onboarding flow.

**Tech Stack:** Turborepo, pnpm workspaces, Next.js 16, Supabase (Auth + Postgres), shadcn/ui, Tailwind CSS

---

### Task 1: Restructure to monorepo

**Files:**
- Create: `packages/core/` (move current `src/`, `tests/`, `tsup.config.ts`, `tsconfig.json`, `package.json`)
- Create: `apps/www/` (move current `www/`)
- Create: `apps/dashboard/` (new Next.js app)
- Create: `turbo.json`
- Modify: root `package.json` → workspace root
- Modify: root `pnpm-workspace.yaml`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/core apps
```

- [ ] **Step 2: Move core package**

```bash
# Move source files to packages/core
mv src packages/core/
mv tests packages/core/
mv tsup.config.ts packages/core/
mv tsconfig.json packages/core/
mv eslint.config.js packages/core/
mv .prettierrc packages/core/
```

- [ ] **Step 3: Move www to apps/**

```bash
mv www apps/www
```

- [ ] **Step 4: Create packages/core/package.json**

```json
{
  "name": "@upiagent/core",
  "version": "0.1.0",
  "description": "UPI payment gateway — QR generation, Gmail verification, LLM parsing.",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "bin": {
    "upiagent": "./dist/setup/cli.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ && tsc --noEmit"
  },
  "dependencies": {
    "@langchain/anthropic": "^1.3.26",
    "@langchain/core": "^1.1.38",
    "@langchain/google-genai": "^2.1.26",
    "@langchain/openai": "^1.4.1",
    "googleapis": "^171.4.0",
    "qrcode": "^1.5.4",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^25.5.0",
    "@types/qrcode": "^1.5.6",
    "eslint": "^10.1.0",
    "prettier": "^3.8.1",
    "tsup": "^8.5.1",
    "typescript": "^6.0.2",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 5: Create root package.json**

```json
{
  "name": "upiagent-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2"
  },
  "packageManager": "pnpm@10.33.0"
}
```

- [ ] **Step 6: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 7: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 8: Install and verify**

```bash
pnpm install
cd packages/core && pnpm build && pnpm test
cd ../../apps/www && pnpm build
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: restructure to turborepo monorepo"
```

---

### Task 2: Scaffold dashboard app

**Files:**
- Create: `apps/dashboard/` (Next.js 16 app)
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/src/app/layout.tsx`
- Create: `apps/dashboard/src/app/page.tsx`
- Create: `apps/dashboard/src/app/globals.css`

- [ ] **Step 1: Create Next.js app**

```bash
cd apps && npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack --yes
```

- [ ] **Step 2: Add @upiagent/core as workspace dependency**

```bash
cd apps/dashboard && pnpm add @upiagent/core@workspace:*
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd apps/dashboard && npx shadcn@latest init --defaults
```

- [ ] **Step 4: Add core shadcn components**

```bash
npx shadcn@latest add button input card table badge tabs separator avatar dropdown-menu dialog sheet toast form label select checkbox
```

- [ ] **Step 5: Set dark theme globals.css**

Replace `apps/dashboard/src/app/globals.css` with dark theme matching the landing page (zinc/green accent palette).

- [ ] **Step 6: Set layout with dark class and Geist fonts**

Update `apps/dashboard/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "upiagent — Dashboard",
  description: "UPI payment gateway dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create placeholder dashboard page**

`apps/dashboard/src/app/page.tsx`:
```tsx
export default function DashboardHome() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-2xl font-mono">upiagent dashboard</h1>
    </div>
  );
}
```

- [ ] **Step 8: Verify build**

```bash
cd apps/dashboard && pnpm build
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold dashboard app with shadcn/ui dark theme"
```

---

### Task 3: Set up Supabase

**Files:**
- Create: `apps/dashboard/.env.local`
- Create: `apps/dashboard/src/lib/supabase/client.ts`
- Create: `apps/dashboard/src/lib/supabase/server.ts`
- Create: `apps/dashboard/src/lib/supabase/middleware.ts`
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Install Supabase packages**

```bash
cd apps/dashboard && pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create .env.local**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Create browser client**

`apps/dashboard/src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: Create server client**

`apps/dashboard/src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}
```

- [ ] **Step 5: Create middleware for auth**

`apps/dashboard/src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login") && !request.nextUrl.pathname.startsWith("/signup") && !request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 6: Create proxy.ts (Next.js 16 middleware)**

`apps/dashboard/src/proxy.ts`:
```typescript
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 7: Create initial database migration**

`supabase/migrations/001_initial_schema.sql`:
```sql
-- Merchants table (extends Supabase Auth users)
create table merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  upi_id text not null,
  name text not null,
  gmail_client_id text,
  gmail_client_secret text,
  gmail_refresh_token text,
  llm_provider text default 'gemini',
  llm_api_key text,
  enabled_sources text[] default '{gmail}',
  webhook_url text,
  webhook_secret text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- API keys
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  key_hash text not null,
  key_prefix text not null,
  name text default 'Default',
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- Payments
create table payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  transaction_id text unique not null,
  amount numeric(12,2) not null,
  amount_with_paisa numeric(12,2),
  note text,
  intent_url text,
  qr_data_url text,
  status text default 'pending',
  expires_at timestamptz,
  upi_reference_id text,
  sender_name text,
  sender_upi_id text,
  bank_name text,
  verification_source text,
  overall_confidence numeric(3,2),
  screenshot_url text,
  created_at timestamptz default now(),
  verified_at timestamptz
);

-- Verification evidence
create table verification_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete cascade,
  source text not null,
  status text not null,
  confidence numeric(3,2),
  extracted_amount numeric(12,2),
  extracted_upi_ref text,
  extracted_sender text,
  extracted_bank text,
  extracted_timestamp timestamptz,
  raw_data jsonb,
  layer_results jsonb,
  created_at timestamptz default now()
);

-- Webhook deliveries
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete cascade,
  url text not null,
  method text default 'POST',
  request_body jsonb,
  status_code int,
  response_body text,
  attempt int default 1,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

-- Row Level Security
alter table merchants enable row level security;
alter table api_keys enable row level security;
alter table payments enable row level security;
alter table verification_evidence enable row level security;
alter table webhook_deliveries enable row level security;

-- Policies: merchants can only see their own data
create policy "Users can view own merchant" on merchants for select using (user_id = auth.uid());
create policy "Users can update own merchant" on merchants for update using (user_id = auth.uid());
create policy "Users can insert own merchant" on merchants for insert with check (user_id = auth.uid());

create policy "Users can view own api_keys" on api_keys for all using (
  merchant_id in (select id from merchants where user_id = auth.uid())
);

create policy "Users can view own payments" on payments for all using (
  merchant_id in (select id from merchants where user_id = auth.uid())
);

create policy "Users can view own evidence" on verification_evidence for all using (
  payment_id in (
    select p.id from payments p
    join merchants m on p.merchant_id = m.id
    where m.user_id = auth.uid()
  )
);

create policy "Users can view own webhooks" on webhook_deliveries for all using (
  payment_id in (
    select p.id from payments p
    join merchants m on p.merchant_id = m.id
    where m.user_id = auth.uid()
  )
);

-- Indexes
create index idx_payments_merchant on payments(merchant_id);
create index idx_payments_status on payments(status);
create index idx_payments_txn_id on payments(transaction_id);
create index idx_payments_created on payments(created_at desc);
create index idx_evidence_payment on verification_evidence(payment_id);
create index idx_webhook_payment on webhook_deliveries(payment_id);
create index idx_api_keys_hash on api_keys(key_hash);
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase auth, clients, middleware, and database schema"
```

---

### Task 4: Auth pages (login + signup)

**Files:**
- Create: `apps/dashboard/src/app/login/page.tsx`
- Create: `apps/dashboard/src/app/signup/page.tsx`
- Create: `apps/dashboard/src/app/auth/callback/route.ts`
- Create: `apps/dashboard/src/components/auth-form.tsx`

- [ ] **Step 1: Create auth form component**

`apps/dashboard/src/components/auth-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  };

  const handleGoogleAuth = async () => {
    setError("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <Card className="w-full max-w-sm border-border bg-surface">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl font-semibold">
          {mode === "login" ? "Welcome back" : "Create account"}
        </CardTitle>
        <CardDescription>
          {mode === "login" ? "Sign in to your dashboard" : "Start accepting UPI payments"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" className="w-full" onClick={handleGoogleAuth}>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          {mode === "login" ? (
            <>No account? <a href="/signup" className="underline">Sign up</a></>
          ) : (
            <>Have an account? <a href="/login" className="underline">Sign in</a></>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create login page**

`apps/dashboard/src/app/login/page.tsx`:
```tsx
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-mono text-lg">upiagent</h1>
        </div>
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create signup page**

`apps/dashboard/src/app/signup/page.tsx`:
```tsx
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-mono text-lg">upiagent</h1>
        </div>
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create OAuth callback handler**

`apps/dashboard/src/app/auth/callback/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
```

- [ ] **Step 5: Verify auth flow builds**

```bash
cd apps/dashboard && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add login/signup pages with Supabase Auth (Google + email)"
```

---

### Task 5: Onboarding flow

**Files:**
- Create: `apps/dashboard/src/app/onboarding/page.tsx`
- Create: `apps/dashboard/src/app/onboarding/actions.ts`
- Create: `apps/dashboard/src/components/onboarding-form.tsx`

- [ ] **Step 1: Create onboarding server action**

`apps/dashboard/src/app/onboarding/actions.ts`:
```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createMerchant(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("merchants").insert({
    user_id: user.id,
    upi_id: formData.get("upiId") as string,
    name: formData.get("name") as string,
  });

  if (error) throw new Error(error.message);
  redirect("/dashboard");
}
```

- [ ] **Step 2: Create onboarding form component**

`apps/dashboard/src/components/onboarding-form.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { createMerchant } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OnboardingForm() {
  return (
    <Card className="w-full max-w-md border-border bg-surface">
      <CardHeader>
        <CardTitle>Set up your account</CardTitle>
        <CardDescription>Tell us about your business to start accepting payments.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createMerchant} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Business name</Label>
            <Input id="name" name="name" placeholder="My Shop" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="upiId">UPI ID</Label>
            <Input id="upiId" name="upiId" placeholder="shop@ybl" required className="font-mono" />
            <p className="text-xs text-muted-foreground">The UPI ID where you receive payments</p>
          </div>
          <Button type="submit" className="w-full">Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create onboarding page**

`apps/dashboard/src/app/onboarding/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check if already onboarded
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (merchant) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <OnboardingForm />
    </div>
  );
}
```

- [ ] **Step 4: Update dashboard page to check onboarding**

`apps/dashboard/src/app/dashboard/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!merchant) redirect("/onboarding");

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-2">Dashboard</h1>
      <p className="text-sm text-muted-foreground font-mono">{merchant.name} — {merchant.upi_id}</p>
    </div>
  );
}
```

- [ ] **Step 5: Move root page to redirect**

`apps/dashboard/src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 6: Build and verify**

```bash
cd apps/dashboard && pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add onboarding flow — merchant name + UPI ID setup"
```

---

### Task 6: Dashboard shell layout

**Files:**
- Create: `apps/dashboard/src/app/dashboard/layout.tsx`
- Create: `apps/dashboard/src/components/sidebar.tsx`
- Create: `apps/dashboard/src/components/header.tsx`

- [ ] **Step 1: Create sidebar component**

`apps/dashboard/src/components/sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "◆" },
  { href: "/dashboard/payments", label: "Payments", icon: "◇" },
  { href: "/dashboard/create", label: "Create", icon: "+" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
  { href: "/dashboard/api-keys", label: "API Keys", icon: "🔑" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "↗" },
  { href: "/dashboard/embed", label: "Embed", icon: "◫" },
  { href: "/dashboard/ops", label: "Operations", icon: "◉" },
];

export function Sidebar({ merchantName }: { merchantName: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-border">
        <div className="font-mono text-sm font-semibold">upiagent</div>
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{merchantName}</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                active ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
              }`}
            >
              <span className="text-xs w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create header component**

`apps/dashboard/src/components/header.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-6">
      <div />
      <div className="text-xs text-muted-foreground font-mono">
        {user?.email}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create dashboard layout**

`apps/dashboard/src/app/dashboard/layout.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!merchant) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <Sidebar merchantName={merchant.name} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build and verify**

```bash
cd apps/dashboard && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add dashboard shell layout with sidebar navigation"
```

---

## Summary

After Plan 1 completes, we have:
- Turborepo monorepo (`packages/core`, `apps/www`, `apps/dashboard`)
- Supabase Auth (Google + email login)
- Database schema with RLS policies
- Onboarding flow (merchant name + UPI ID)
- Dashboard shell with sidebar navigation
- All pages dark themed with shadcn/ui

**Next:** Plan 2 covers dashboard features — payments list, payment detail, create payment, settings.
