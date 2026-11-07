import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/teacher/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeacherAuth } from "@/context/TeacherAuthContext";

export const Route = createFileRoute("/teacher/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — ClassBridge" },
      { name: "description", content: "Request a teacher password reset email." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const { forgotPassword, authAvailable } = useTeacherAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email.");
      return;
    }
    setError("");
    if (!authAvailable) {
      toast.error("Configure Supabase to send reset emails.");
      return;
    }
    setBusy(true);
    try {
      await forgotPassword(email);
      setSent(true);
      toast.success("Check your email for a reset link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We'll email a reset link to your teacher account."
      footer={
        <Link to="/teacher/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for <strong className="text-foreground">{email}</strong>, a reset link is on its way. Check spam folders too.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} autoComplete="email" />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
