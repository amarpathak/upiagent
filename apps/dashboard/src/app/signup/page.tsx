export const dynamic = "force-dynamic";

import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">upiagent</h1>
      <AuthForm mode="signup" />
    </div>
  );
}
