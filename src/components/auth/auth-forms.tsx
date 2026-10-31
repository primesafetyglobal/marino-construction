"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { useActionForm } from "@/lib/forms";
import { acceptInvite, requestPasswordReset, resetPassword, verifyEmail } from "@/server/modules/access/user/user.actions";
import { acceptInviteSchema, requestPasswordResetSchema } from "@/server/modules/access/user/user.schema";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("reason") === "password-changed" ? null : null);
  const [pending, setPending] = useState(false);
  const notice = params.get("reason") === "password-changed" ? "Your password was changed. Sign in with the new one." : null;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await signIn("credentials", { email, password, redirect: false });
        setPending(false);
        if (!res || res.error) {
          setError(res?.error === "RATE_LIMITED" ? "Too many failed attempts. Login is blocked for 15 minutes." : "Invalid email or password.");
          return;
        }
        const next = params.get("callbackUrl");
        router.replace(next && next.startsWith("/") ? next : "/admin");
        router.refresh();
      }}
    >
      {notice && <p className="rounded-xl bg-success-tint px-4 py-3 text-sm text-success">{notice}</p>}
      <Field label="Email" name="email">
        <Input placeholder="name@example.rw" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" name="password">
        <Input placeholder="At least 8 characters" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending} data-testid="login-submit">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
      </Button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-muted hover:text-ink">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const form = useActionForm<{ message: string }>();
  if (sent) return <p className="rounded-xl bg-mist px-4 py-4 text-center">{sent}</p>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await form.run({ schema: requestPasswordResetSchema, input: { email }, action: requestPasswordReset });
        if (r) setSent(r.message);
      }}
    >
      <Field label="Your email" name="email" error={form.errors.email}>
        <Input placeholder="name@example.rw" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
      <Button type="submit" size="lg" className="w-full" disabled={form.pending}>
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted hover:text-ink">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

// Invite and reset share one form: set a password from a one-time link, then sign in.
export function SetPasswordForm({ token, mode }: { token: string; mode: "invite" | "reset" }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const form = useActionForm<{ email: string }>();
  const errors = form.errors;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const input = { token, password, confirmPassword };
        const r = await form.run({ schema: acceptInviteSchema, input, action: mode === "invite" ? acceptInvite : resetPassword });
        if (!r) return;
        const signed = await signIn("credentials", { email: r.email, password, redirect: false });
        router.replace(signed && !signed.error ? "/admin" : "/login");
        router.refresh();
      }}
    >
      <Field label="New password" name="password" error={errors.password} hint="At least 10 characters.">
        <Input placeholder="At least 8 characters" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
      </Field>
      <Field label="Repeat the password" name="confirmPassword" error={errors.confirmPassword}>
        <Input placeholder="At least 8 characters" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} invalid={!!errors.confirmPassword} />
      </Field>
      <FormError message={errors.token?.[0] ?? (form.formError && !form.formError.fieldErrors ? form.formError.message : null)} />
      <Button type="submit" size="lg" className="w-full" disabled={form.pending} data-testid="set-password-submit">
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "invite" ? "Set my password" : "Save new password"}
      </Button>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [done, setDone] = useState<string | null>(null);
  const form = useActionForm<{ email: string }>();
  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <p>
          Your email is now <strong>{done}</strong>.
        </p>
        <Link href="/admin/account" className="font-semibold hover:underline">
          Go to my account
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <FormError message={form.errors.token?.[0] ?? form.formError?.message} />
      <Button
        size="lg"
        className="w-full"
        disabled={form.pending}
        onClick={async () => {
          const r = await form.run({ input: { token }, action: verifyEmail });
          if (r) setDone(r.email);
        }}
      >
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm my new email
      </Button>
    </div>
  );
}
