/**
 * Seed mid-term demo data through real ClassBridge auth + RLS + RPCs + Edge Functions.
 * Usage: npm run demo:seed
 * Refuse if scripts/.demo-seed.json already exists — run demo:clear first.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

function loadAccounts() {
  const src = readFileSync(join(ROOT, "src/data/prototypeAccounts.ts"), "utf8");
  const pwd = src.match(/PROTOTYPE_PASSWORD\s*=\s*"([^"]+)"/)?.[1];
  if (!pwd) throw new Error("Could not parse PROTOTYPE_PASSWORD from prototypeAccounts.ts");
  const emails = [...src.matchAll(/email:\s*"([^"]+)"/g)].map((m) => m[1]);
  const names = [...src.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
  const roles = [...src.matchAll(/role:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (emails.length < 5) throw new Error("Expected at least 5 prototype accounts");
  const byRole = {};
  emails.forEach((email, i) => {
    byRole[roles[i]] ??= [];
    byRole[roles[i]].push({ email, name: names[i], password: pwd, role: roles[i] });
  });
  return {
    teacher: byRole.teacher[0],
    students: byRole.student,
    parent: byRole.parent[0],
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(step, detail = "") {
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ""}`);
}

function clientFor(url, anon) {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(url, anon, account) {
  const sb = clientFor(url, anon);
  const { data, error } = await sb.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw new Error(`Sign-in failed for ${account.email}: ${error.message}`);
  return { sb, token: data.session.access_token, userId: data.user.id };
}

async function invokeFn(url, anon, path, token, body, extraHeaders = {}, attempt = 0) {
  const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 429 && attempt < 1) {
    console.log(`  … rate limited on ${path}, waiting 6s and retrying`);
    await sleep(6000);
    return invokeFn(url, anon, path, token, body, extraHeaders, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${typeof json.error === "string" ? json.error : JSON.stringify(json)}`);
  }
  return json;
}

function saveSeed(seed) {
  writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2));
}

function daysFromNow(days, hour = 17) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  if (existsSync(SEED_PATH)) {
    console.error("scripts/.demo-seed.json already exists. Run `npm run demo:clear` first.");
    process.exit(1);
  }

  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env");

  const accounts = loadAccounts();
  const seed = {
    createdAt: new Date().toISOString(),
    sessions: [],
    homework: [],
    quizzes: [],
    notes: [],
  };
  saveSeed(seed);

  console.log("Signing in…");
  const teacher = await signIn(url, anon, accounts.teacher);
  const aanya = await signIn(url, anon, accounts.students.find((s) => s.email.startsWith("aanya")));
  const lucas = await signIn(url, anon, accounts.students.find((s) => s.email.startsWith("lucas")));
  const mei = await signIn(url, anon, accounts.students.find((s) => s.email.startsWith("mei")));
  log("Auth", "teacher + 3 students");

  const { data: courses, error: courseErr } = await teacher.sb.from("courses").select("id, code, name, subject");
  if (courseErr) throw new Error(courseErr.message);
  const math = courses.find((c) => c.code === "MATH-5A");
  const sci = courses.find((c) => c.code === "SCI-5A");
  if (!math || !sci) throw new Error("Expected courses MATH-5A and SCI-5A");
  log("Courses", `${math.code}, ${sci.code}`);

  // ---------------------------------------------------------------------------
  // 1) Past lesson + questions + radar
  // ---------------------------------------------------------------------------
  const notes =
    "Equivalent fractions. A fraction shows part of a whole. " +
    "When you multiply (or divide) the numerator and the denominator by the same number, " +
    "you get an equivalent fraction — it names the same amount. " +
    "Examples: 1/2 = 2/4 = 4/8. The pieces look different, but they cover the same share of the whole.";

  const created = await invokeFn(url, anon, "teacher-session", teacher.token, {
    action: "create",
    course_id: math.id,
    title: "Equivalent fractions",
    subject: math.subject,
    notes,
  });
  const sessionId = created.session.id;
  const teacherToken = created.teacher_token;
  seed.sessions.push({ id: sessionId, title: "Equivalent fractions", course: "MATH-5A" });
  saveSeed(seed);
  log("Session create", sessionId);

  await invokeFn(
    url,
    anon,
    "teacher-session",
    teacher.token,
    { action: "set_status", session_id: sessionId, status: "live" },
    { "x-teacher-token": teacherToken },
  );
  log("Session live");

  async function join(studentAuth, language) {
    const { data, error } = await studentAuth.sb.rpc("join_live_session", {
      p_session_id: sessionId,
      p_language: language,
    });
    if (error) throw new Error(`join_live_session: ${error.message}`);
    return data;
  }

  const aanyaRow = await join(aanya, "en");
  const lucasRow = await join(lucas, "fr");
  const meiRow = await join(mei, "hi");
  log("Students joined lesson");

  const questions = [
    { who: aanya, row: aanyaRow, lang: "en", text: "Isn't 2/4 bigger than 1/2? The top and bottom numbers are both bigger." },
    { who: lucas, row: lucasRow, lang: "fr", text: "Pourquoi 2/4 n'est pas plus grand que 1/2 ? Les chiffres sont plus grands." },
    { who: mei, row: meiRow, lang: "hi", text: "2/4, 1/2 से बड़ा क्यों नहीं है? संख्याएँ तो बड़ी हैं।" },
    { who: aanya, row: aanyaRow, lang: "en", text: "2/4 mein numbers bade hain toh woh 1/2 se bada hona chahiye na?" },
    { who: lucas, row: lucasRow, lang: "en", text: "If I multiply the top and bottom, doesn't the fraction get bigger?" },
    { who: mei, row: meiRow, lang: "en", text: "So 4/8 is more pizza than 1/2 because eight is a bigger number?" },
    { who: aanya, row: aanyaRow, lang: "en", text: "How do I add 1/3 + 1/4? Do I add the tops and bottoms?" },
    { who: lucas, row: lucasRow, lang: "en", text: "When is the field trip this term?" },
  ];

  for (const q of questions) {
    await invokeFn(url, anon, "process-question", q.who.token, {
      session_id: sessionId,
      text: q.text,
      student_language: q.lang,
      student_id: q.row.id,
      student_name: q.row.name,
    });
    log("Question", q.text.slice(0, 56) + (q.text.length > 56 ? "…" : ""));
    await sleep(4000);
  }

  const radar = await invokeFn(
    url,
    anon,
    "analyze-misconceptions",
    teacher.token,
    { session_id: sessionId },
    { "x-teacher-token": teacherToken },
  );
  const clusters = radar.misconceptions ?? [];
  console.log("  Radar clusters:");
  for (const c of clusters) {
    console.log(`   • ${c.label} (${c.question_ids?.length ?? 0} Qs) — ${c.suggested_intervention?.slice(0, 80) ?? ""}`);
  }
  seed.notes.push({ radarClusters: clusters.map((c) => ({ label: c.label, n: c.question_ids?.length })) });
  saveSeed(seed);
  log("Misconception radar", `${clusters.length} cluster(s)`);

  await invokeFn(
    url,
    anon,
    "teacher-session",
    teacher.token,
    { action: "set_status", session_id: sessionId, status: "ended" },
    { "x-teacher-token": teacherToken },
  );
  log("Session ended");

  // ---------------------------------------------------------------------------
  // 2) Homework A — past due, graded & published
  // ---------------------------------------------------------------------------
  const { data: hwA, error: hwAErr } = await teacher.sb
    .from("homework")
    .insert({
      course_id: math.id,
      title: "Comparing fractions practice",
      subject: "Mathematics",
      topic: "Comparing fractions",
      description: "Practice comparing fractions with the same numerator or denominator.",
      instructions: "Show your thinking. Use drawings or number lines if they help.",
      due_at: daysFromNow(-5),
      total_marks: 10,
      status: "published",
      tasks: [
        { id: "t1", prompt: "Which is larger: 3/8 or 3/5? Explain.", marks: 3 },
        { id: "t2", prompt: "Order from smallest to largest: 1/2, 2/5, 3/4.", marks: 4 },
        { id: "t3", prompt: "Write one real-life example of comparing two fractions.", marks: 3 },
      ],
    })
    .select("*")
    .single();
  if (hwAErr) throw new Error(hwAErr.message);
  seed.homework.push({ id: hwA.id, title: hwA.title, course: "MATH-5A" });
  saveSeed(seed);
  log("Homework A", hwA.title);

  async function submitHw(studentAuth, homeworkId, answers) {
    const { data, error } = await studentAuth.sb.rpc("submit_homework", {
      p_homework_id: homeworkId,
      p_answers: answers,
    });
    if (error) throw new Error(`submit_homework: ${error.message}`);
    return data;
  }

  await submitHw(aanya, hwA.id, {
    t1: "3/5 is larger because fifths are bigger pieces than eighths when the numerator is the same.",
    t2: "2/5, 1/2, 3/4",
    t3: "Sharing a chocolate bar: 1/2 vs 1/3 of the same bar.",
  });
  await submitHw(lucas, hwA.id, {
    t1: "3/8 is bigger because 8 > 5.",
    t2: "1/2, 2/5, 3/4",
    t3: "Pizza slices at lunch.",
  });
  await submitHw(mei, hwA.id, {
    t1: "I think 3/5 > 3/8 — same number of pieces but larger pieces for 3/5.",
    t2: "2/5 < 1/2 < 3/4",
    t3: "Two water bottles: half full vs three-quarters full.",
  });
  log("Homework A submissions", "3 students");

  const { data: subsA, error: subsAErr } = await teacher.sb
    .from("homework_submissions")
    .select("id, student_id, people(full_name)")
    .eq("homework_id", hwA.id);
  if (subsAErr) throw new Error(subsAErr.message);

  const gradePlan = {
    "Aanya Patel": { marks: 9, feedback: "Clear reasoning — excellent." },
    "Lucas Martin": { marks: 4, feedback: "Watch out: a larger denominator means smaller pieces when numerators match." },
    "Mei Chen": { marks: 8, feedback: "Strong work. Nice ordering on question 2." },
  };

  for (const s of subsA) {
    const name = s.people?.full_name ?? "";
    const plan = gradePlan[name] ?? { marks: 6, feedback: "Good effort." };
    const { error } = await teacher.sb.rpc("grade_homework", {
      p_submission_id: s.id,
      p_marks: plan.marks,
      p_feedback: plan.feedback,
      p_publish: true,
    });
    if (error) throw new Error(`grade_homework (${name}): ${error.message}`);
  }
  log("Homework A graded + published");

  // ---------------------------------------------------------------------------
  // 3) Homework B — upcoming, no submissions
  // ---------------------------------------------------------------------------
  const { data: hwB, error: hwBErr } = await teacher.sb
    .from("homework")
    .insert({
      course_id: math.id,
      title: "Fractions in real life",
      subject: "Mathematics",
      topic: "Fractions applications",
      description: "Find fractions in everyday situations.",
      instructions: "Bring one example from home or school. Be ready to explain it to a partner.",
      due_at: daysFromNow(3),
      total_marks: 8,
      status: "published",
      tasks: [
        { id: "t1", prompt: "Describe a real-life fraction you noticed this week.", marks: 4 },
        { id: "t2", prompt: "Write that amount as a fraction and explain the whole.", marks: 4 },
      ],
    })
    .select("*")
    .single();
  if (hwBErr) throw new Error(hwBErr.message);
  seed.homework.push({ id: hwB.id, title: hwB.title, course: "MATH-5A" });
  saveSeed(seed);
  log("Homework B", `${hwB.title} (open, no submissions)`);

  // ---------------------------------------------------------------------------
  // 4) Quiz — Fractions check 1
  // ---------------------------------------------------------------------------
  const quizQuestions = [
    {
      id: "q1",
      type: "multiple_choice",
      prompt: "Which fraction is equivalent to 1/2?",
      options: ["2/3", "2/4", "3/5", "1/3"],
      marks: 1,
      topic: "Equivalent fractions",
    },
    {
      id: "q2",
      type: "multiple_choice",
      prompt: "Which shows the same amount as 3/6?",
      options: ["1/3", "1/2", "2/3", "3/4"],
      marks: 1,
      topic: "Equivalent fractions",
    },
    {
      id: "q3",
      type: "multiple_choice",
      prompt: "Which is larger: 2/5 or 2/7?",
      options: ["2/5", "2/7", "They are equal", "Cannot tell"],
      marks: 1,
      topic: "Comparing fractions",
    },
    {
      id: "q4",
      type: "multiple_choice",
      prompt: "Which is smaller: 4/5 or 3/5?",
      options: ["4/5", "3/5", "They are equal", "Cannot tell"],
      marks: 1,
      topic: "Comparing fractions",
    },
    {
      id: "q5",
      type: "multiple_choice",
      prompt: "1/3 compared with 1/4 — which is larger?",
      options: ["1/3", "1/4", "They are equal", "Cannot tell"],
      marks: 1,
      topic: "Comparing fractions",
    },
  ];
  // correct indices: q1->1 (2/4), q2->1 (1/2), q3->0 (2/5), q4->1 (3/5), q5->0 (1/3)
  const answerKey = { q1: 1, q2: 1, q3: 0, q4: 1, q5: 0 };

  const { data: quiz, error: quizErr } = await teacher.sb
    .from("quizzes")
    .insert({
      course_id: math.id,
      kind: "quiz",
      title: "Fractions check 1",
      subject: "Mathematics",
      topic: "Equivalent & comparing fractions",
      status: "published",
      due_at: daysFromNow(-2),
      questions: quizQuestions,
    })
    .select("*")
    .single();
  if (quizErr) throw new Error(quizErr.message);

  const { error: keyErr } = await teacher.sb.from("quiz_answer_keys").insert({
    quiz_id: quiz.id,
    answer_key: answerKey,
  });
  if (keyErr) throw new Error(keyErr.message);
  seed.quizzes.push({ id: quiz.id, title: quiz.title, course: "MATH-5A" });
  saveSeed(seed);
  log("Quiz", quiz.title);

  // Scores ~5/5, 3/5, 2/5 with different wrong answers
  const quizAnswers = {
    aanya: { q1: 1, q2: 1, q3: 0, q4: 1, q5: 0 }, // 5/5
    lucas: { q1: 1, q2: 0, q3: 0, q4: 0, q5: 0 }, // 3/5 — wrong q2,q4
    mei: { q1: 0, q2: 1, q3: 1, q4: 1, q5: 1 }, // 2/5 — wrong q1,q3,q5
  };

  for (const [label, auth, answers] of [
    ["Aanya", aanya, quizAnswers.aanya],
    ["Lucas", lucas, quizAnswers.lucas],
    ["Mei", mei, quizAnswers.mei],
  ]) {
    const { data, error } = await auth.sb.rpc("submit_quiz", {
      p_quiz_id: quiz.id,
      p_answers: answers,
    });
    if (error) throw new Error(`submit_quiz (${label}): ${error.message}`);
    log(`Quiz attempt ${label}`, `auto ${data?.auto_score}/${data?.total}`);
  }

  const { data: publishedN, error: pubErr } = await teacher.sb.rpc("publish_quiz_grades", {
    p_quiz_id: quiz.id,
  });
  if (pubErr) throw new Error(pubErr.message);
  log("Quiz grades released", `${publishedN} row(s)`);

  // ---------------------------------------------------------------------------
  // 5) SCI-5A homework
  // ---------------------------------------------------------------------------
  const { data: hwSci, error: hwSciErr } = await teacher.sb
    .from("homework")
    .insert({
      course_id: sci.id,
      title: "States of matter journal",
      subject: "Science",
      topic: "States of matter",
      description: "Observe solids, liquids and gases around you.",
      instructions: "List two examples of each state and one change of state you saw.",
      due_at: daysFromNow(-3),
      total_marks: 12,
      status: "published",
      tasks: [
        { id: "t1", prompt: "Two solids and why they are solids.", marks: 4 },
        { id: "t2", prompt: "Two liquids and why they are liquids.", marks: 4 },
        { id: "t3", prompt: "Describe one change of state (e.g. melting, evaporation).", marks: 4 },
      ],
    })
    .select("*")
    .single();
  if (hwSciErr) throw new Error(hwSciErr.message);
  seed.homework.push({ id: hwSci.id, title: hwSci.title, course: "SCI-5A" });
  saveSeed(seed);
  log("SCI homework", hwSci.title);

  await submitHw(aanya, hwSci.id, {
    t1: "Desk and pencil — keep their shape.",
    t2: "Water and juice — take the shape of the cup.",
    t3: "Ice cube melting into water on the windowsill.",
  });
  await submitHw(lucas, hwSci.id, {
    t1: "Rock, book.",
    t2: "Milk, rain.",
    t3: "Puddle drying in the sun (liquid to gas).",
  });

  const { data: sciSubs, error: sciSubsErr } = await teacher.sb
    .from("homework_submissions")
    .select("id, people(full_name)")
    .eq("homework_id", hwSci.id);
  if (sciSubsErr) throw new Error(sciSubsErr.message);
  for (const s of sciSubs) {
    const name = s.people?.full_name ?? "";
    const marks = name.includes("Aanya") ? 11 : 9;
    const { error } = await teacher.sb.rpc("grade_homework", {
      p_submission_id: s.id,
      p_marks: marks,
      p_feedback: name.includes("Aanya") ? "Thorough examples." : "Clear observations — add a bit more detail next time.",
      p_publish: true,
    });
    if (error) throw new Error(`SCI grade (${name}): ${error.message}`);
  }
  log("SCI homework graded + published");

  // ---------------------------------------------------------------------------
  console.log("\n=== Demo seed complete ===");
  console.table([
    { kind: "session", title: "Equivalent fractions", id: sessionId, status: "ended" },
    ...seed.homework.map((h) => ({ kind: "homework", title: h.title, id: h.id, status: h.course })),
    ...seed.quizzes.map((q) => ({ kind: "quiz", title: q.title, id: q.id, status: q.course })),
  ]);
  console.log(`\nSeed file: ${SEED_PATH}`);
  console.log("Portals: teacher /teacher · student /student · parent /parent");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message || err);
  console.error("Partial IDs were saved to scripts/.demo-seed.json — run npm run demo:clear, then fix and retry.");
  process.exit(1);
});
