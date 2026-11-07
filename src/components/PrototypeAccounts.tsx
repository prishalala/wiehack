import { PROTOTYPE_ACCOUNTS } from "@/data/prototypeAccounts";

/** Hackathon-only hint so testers can sign in without institution admin tooling. */
export function PrototypeAccounts({ role }: { role: "teacher" | "student" | "parent" }) {
  const rows = PROTOTYPE_ACCOUNTS.filter((a) => a.role === role);
  if (!rows.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-primary/15 bg-primary-soft/60 px-3.5 py-3 text-xs shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-foreground">
        Prototype test account{rows.length > 1 ? "s" : ""}
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((a) => (
          <li key={a.email} className="leading-snug">
            <span className="font-mono text-[12px] font-medium text-foreground">{a.email}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-mono text-[12px] text-foreground">{a.password}</span>
            <span className="text-muted-foreground"> ({a.name})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
