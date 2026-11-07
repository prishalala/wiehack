import { PROTOTYPE_ACCOUNTS } from "@/data/prototypeAccounts";

/** Hackathon-only hint so testers can sign in without institution admin tooling. */
export function PrototypeAccounts({ role }: { role: "teacher" | "student" | "parent" }) {
  const rows = PROTOTYPE_ACCOUNTS.filter((a) => a.role === role);
  if (!rows.length) return null;
  return (
    <div className="mb-4 rounded-lg border border-dashed bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Prototype test account{rows.length > 1 ? "s" : ""}</p>
      <ul className="mt-1 space-y-1">
        {rows.map((a) => (
          <li key={a.email}>
            <span className="font-mono text-foreground">{a.email}</span>
            <span> · </span>
            <span className="font-mono text-foreground">{a.password}</span>
            <span> ({a.name})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
