"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/lib/forms";
import { changeOwnPassword, inviteUser, requestEmailChange, updateUser } from "@/server/modules/access/user/user.actions";
import { changeOwnPasswordSchema, inviteUserSchema, requestEmailChangeSchema, updateUserSchema } from "@/server/modules/access/user/user.schema";
import { ROLE_LABEL } from "@/server/modules/access/access.fields";

type Role = keyof typeof ROLE_LABEL;

export function InviteUserButton({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", email: "", role: "STAFF", phone: "" });
  const form = useActionForm<{ emailSent: boolean }>();
  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="invite-open">
        Invite user
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a user"
        footer={
          <Button
            disabled={form.pending}
            data-testid="invite-save"
            onClick={async () => {
              const r = await form.run({ schema: inviteUserSchema, input: v, action: inviteUser });
              if (!r) return;
              toast(r.emailSent ? "success" : "error", r.emailSent ? "Invite sent." : "User created, but the invite email failed. Use “Resend invite”.");
              setOpen(false);
              setV({ name: "", email: "", role: "STAFF", phone: "" });
              router.refresh();
            }}
          >
            {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Send invite
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Name" error={form.errors.name}>
            <Input placeholder="e.g. Jean Mugisha" name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <Field label="Email" error={form.errors.email}>
            <Input placeholder="name@example.rw" name="email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </Field>
          <Field label="Phone" optional error={form.errors.phone}>
            <Input placeholder="+250 788 123 456" name="phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
          <Field label="Role" error={form.errors.role}>
            <Select name="role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-muted">The user gets an email link (valid 7 days) to set their own password.</p>
          <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
        </div>
      </Dialog>
    </>
  );
}

export function EditUserButton({ user, roles }: { user: { id: string; name: string; phone: string | null; role: Role }; roles: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: user.name, phone: user.phone ?? "", role: user.role as string });
  const form = useActionForm<unknown>();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit user"
        footer={
          <Button
            disabled={form.pending}
            onClick={async () => {
              const input = { id: user.id, name: v.name, phone: v.phone, ...(roles.length && v.role !== user.role ? { role: v.role } : {}) };
              const r = await form.run({ schema: updateUserSchema, input, action: updateUser });
              if (!r) return;
              toast("success", "User updated.");
              setOpen(false);
              router.refresh();
            }}
          >
            {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Name" error={form.errors.name}>
            <Input placeholder="e.g. Jean Mugisha" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <Field label="Phone" optional error={form.errors.phone}>
            <Input placeholder="+250 788 123 456" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
          <Field label="Role" hint={roles.length ? undefined : "You cannot change your own role."}>
            <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} disabled={!roles.length}>
              {(roles.length ? roles : [user.role]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r as Role]}
                </option>
              ))}
            </Select>
          </Field>
          <FormError message={form.formError?.message} />
        </div>
      </Dialog>
    </>
  );
}

export function ChangePasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const form = useActionForm<{ email: string }>();
  const e = form.errors;
  return (
    <form
      className="space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const r = await form.run({ schema: changeOwnPasswordSchema, input: v, action: changeOwnPassword });
        if (!r) return;
        // D-9: every older session ends; this device signs in again with the new password.
        const again = await signIn("credentials", { email, password: v.newPassword, redirect: false });
        toast("success", "Password changed. Your other sessions were signed out.");
        setV({ currentPassword: "", newPassword: "", confirmPassword: "" });
        if (!again || again.error) router.replace("/login?reason=password-changed");
        else router.refresh();
      }}
    >
      <Field label="Current password" error={e.currentPassword}>
        <Input placeholder="At least 8 characters" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(x) => setV({ ...v, currentPassword: x.target.value })} />
      </Field>
      <Field label="New password" error={e.newPassword} hint="At least 10 characters.">
        <Input placeholder="At least 8 characters" type="password" autoComplete="new-password" value={v.newPassword} onChange={(x) => setV({ ...v, newPassword: x.target.value })} />
      </Field>
      <Field label="Repeat the new password" error={e.confirmPassword}>
        <Input placeholder="At least 8 characters" type="password" autoComplete="new-password" value={v.confirmPassword} onChange={(x) => setV({ ...v, confirmPassword: x.target.value })} />
      </Field>
      <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
      <Button type="submit" disabled={form.pending}>
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Change password
      </Button>
    </form>
  );
}

export function ChangeEmailForm() {
  const [newEmail, setNewEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const form = useActionForm<{ emailSent: boolean }>();
  if (sent) return <p className="rounded-xl bg-mist px-4 py-3 text-sm">We sent a confirmation link to {sent}. Your email changes when you open it.</p>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const r = await form.run({ schema: requestEmailChangeSchema, input: { newEmail }, action: requestEmailChange });
        if (r) setSent(newEmail);
      }}
    >
      <Field label="New email" error={form.errors.newEmail}>
        <Input placeholder="name@example.rw" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
      </Field>
      <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
      <Button type="submit" variant="outline" disabled={form.pending}>
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Send confirmation link
      </Button>
    </form>
  );
}
