import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useTeacherAuth } from "@/context/TeacherAuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/settings")({
  head: () => ({ meta: [{ title: "Settings — ClassBridge" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { teacher, authAvailable, signOut } = useTeacherAuth();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted-foreground">Teacher account and portal preferences.</p>
      </div>
      <div className="surface space-y-4 p-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Signed in as</p>
          <p className="mt-1 font-semibold">{teacher?.fullName ?? "Local open access"}</p>
          <p className="text-sm text-muted-foreground">{teacher?.email ?? "Auth not required in this environment"}</p>
        </div>
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Connection</p>
          <p className="mt-1">Supabase project: {isSupabaseConfigured() ? "configured" : "missing env vars"}</p>
          <p>Teacher Auth: {authAvailable ? "available (real sessions)" : "unavailable"}</p>
          {!authAvailable && (
            <p className="mt-2 text-xs">Auth env vars missing — teacher routes stay open locally. Enable Supabase Auth for protected portals.</p>
          )}
        </div>
        {authAvailable && (
          <Button
            variant="outline"
            onClick={() => {
              void signOut()
                .then(() => {
                  toast.success("Signed out");
                  window.location.href = "/teacher/login";
                })
                .catch((e: Error) => toast.error(e.message));
            }}
          >
            Log out
          </Button>
        )}
      </div>
      <div className="surface p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Parent Portal readiness</p>
        <p className="mt-2">
          Grades use a <code className="font-mono text-xs">publishState</code> field. Only <strong>published</strong> grades should be exposed to linked parents later. Parent–student linking models live in{" "}
          <code className="font-mono text-xs">src/types/teacherPortal.ts</code>.
        </p>
      </div>
    </div>
  );
}
