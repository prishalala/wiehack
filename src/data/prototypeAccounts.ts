/** Pre-registered institution accounts for the hackathon prototype. */
export const PROTOTYPE_PASSWORD = "ClassBridgeDemo1!";

export const PROTOTYPE_ACCOUNTS = [
  { email: "alex.morgan@classbridge-demo.edu", name: "Alex Morgan", role: "teacher" as const, password: PROTOTYPE_PASSWORD },
  { email: "aanya.patel@classbridge-demo.edu", name: "Aanya Patel", role: "student" as const, password: PROTOTYPE_PASSWORD },
  { email: "lucas.martin@classbridge-demo.edu", name: "Lucas Martin", role: "student" as const, password: PROTOTYPE_PASSWORD },
  { email: "mei.chen@classbridge-demo.edu", name: "Mei Chen", role: "student" as const, password: PROTOTYPE_PASSWORD },
  { email: "parent.patel@classbridge-demo.edu", name: "Ravi Patel", role: "parent" as const, password: PROTOTYPE_PASSWORD },
] as const;
