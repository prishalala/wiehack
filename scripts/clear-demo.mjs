/**
 * Remove demo rows recorded in scripts/.demo-seed.json (as the teacher, via RLS).
 * Lesson sessions cannot be deleted with the browser role — prints SQL for the SQL editor.
 * Usage: npm run demo:clear
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_PATH = join(__dirname, ".demo-seed.json");

function loadEnv() {
  const raw = readFileSync(join(ROOT, ".env"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function loadTeacherAccount() {
  const src = readFileSync(join(ROOT, "src/data/prototypeAccounts.ts"), "utf8");
  const pwd = src.match(/PROTOTYPE_PASSWORD\s*=\s*"([^"]+)"/)?.[1];
  const emails = [...src.matchAll(/email:\s*"([^"]+)"/g)].map((m) => m[1]);
  const roles = [...src.matchAll(/role:\s*"([^"]+)"/g)].map((m) => m[1]);
  const idx = roles.indexOf("teacher");
  if (idx < 0 || !pwd) throw new Error("Could not parse teacher account from prototypeAccounts.ts");
  return { email: emails[idx], password: pwd };
}

function log(step, detail = "") {
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  if (!existsSync(SEED_PATH)) {
    console.error("No scripts/.demo-seed.json — nothing to clear.");
    process.exit(1);
  }

  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env");

  const account = loadTeacherAccount();
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (authErr) throw new Error(`Teacher sign-in failed: ${authErr.message}`);
  log("Signed in as teacher");

  for (const hw of seed.homework ?? []) {
    const { error } = await sb.from("homework").delete().eq("id", hw.id);
    if (error) console.error(`  homework ${hw.id}: ${error.message}`);
    else log("Deleted homework", hw.title || hw.id);
  }

  for (const q of seed.quizzes ?? []) {
    const { error } = await sb.from("quizzes").delete().eq("id", q.id);
    if (error) console.error(`  quiz ${q.id}: ${error.message}`);
    else log("Deleted quiz", q.title || q.id);
  }

  const sessionIds = (seed.sessions ?? []).map((s) => s.id).filter(Boolean);
  if (sessionIds.length) {
    console.log("\n⚠ Sessions cannot be deleted via the browser role.");
    console.log("Paste this into the Supabase SQL editor:\n");
    const list = sessionIds.map((id) => `'${id}'`).join(", ");
    console.log(`delete from public.sessions where id in (${list});\n`);
    console.log("Session ids:", sessionIds.join(", "));
  }

  unlinkSync(SEED_PATH);
  // leave an empty marker note? user asked to remove the file
  log("Removed", "scripts/.demo-seed.json");
  console.log("\nClear done. After running the session SQL above, you can `npm run demo:seed` again.");
}

main().catch((err) => {
  console.error("Clear failed:", err.message || err);
  process.exit(1);
});
