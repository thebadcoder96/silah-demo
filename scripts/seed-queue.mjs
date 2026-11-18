// Puts a few sample calls in the queue, to look at the quality desk before the
// demos that produce real ones exist. Everything in them is made up.
//   node scripts/seed-queue.mjs                         local dev server (http://localhost:5174)
//   node scripts/seed-queue.mjs https://your-site       a deployment
//   node scripts/seed-queue.mjs --scored                local only: also attach a sample score to the first call
// Clear them again with the "Clear demo queue" button on the quality desk.

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) || "http://localhost:5174").replace(/\/$/, "");

const CALLS = [
  {
    source: "Campaign",
    simulated: true,
    handledBy: "AI",
    client: "Khidmati Service Centre",
    scenario: "Appointment reminder",
    customer: "Maryam Al Sayed",
    language: "ar",
    outcome: "answered",
    disposition: "Confirmed",
    durationSecs: 48,
    summary: "Reminder for an CPR card renewal appointment on Sunday at ten. The customer confirmed she will attend.",
    transcript: [
      { who: "agent", text: "السلام عليكم، وياج المساعد الآلي من مركز خدمتي. أكلم الأخت مريم؟", en: "Peace be upon you, this is the AI assistant from Khidmati Service Centre. Am I speaking with Maryam?" },
      { who: "customer", text: "وعليكم السلام، إي نعم أنا مريم.", en: "And upon you peace. Yes, this is Maryam." },
      { who: "agent", text: "حبيت أذكرج بموعد تجديد البطاقة يوم الأحد الساعة عشر الصبح. بتحضرين؟", en: "I wanted to remind you of your CPR card renewal appointment on Sunday at ten in the morning. Will you attend?" },
      { who: "customer", text: "إي إن شاء الله بحضر.", en: "Yes, God willing, I will attend." },
      { who: "agent", text: "تمام، أكدت لج الموعد: الأحد الساعة عشر. تبين شي ثاني؟", en: "Great, I have confirmed your appointment: Sunday at ten. Do you need anything else?" },
      { who: "customer", text: "لا مشكورة.", en: "No, thank you." },
      { who: "agent", text: "حياج الله، مع السلامة.", en: "You are welcome. Goodbye." },
    ],
  },
  {
    source: "Copilot",
    handledBy: "Human",
    client: "Tylos Telecom",
    scenario: "Bill dispute",
    customer: "Yousif Hasan",
    language: "en",
    outcome: "answered",
    disposition: "Dispute raised",
    durationSecs: 192,
    flags: ["promised_callback"],
    summary: "The customer disputed a roaming charge of twelve dinars on his November bill. The agent confirmed his identity, raised a billing dispute and promised a call back within two working days.",
    transcript: [
      { who: "agent", text: "Thank you for calling Tylos Telecom, this is Sara. How can I help?" },
      { who: "customer", text: "Hi, my bill this month is way higher than usual and I don't know why." },
      { who: "agent", text: "I can look into that for you. Can I have your full name and the last four digits of your CPR?" },
      { who: "customer", text: "Yousif Hasan, and it ends in four four one two." },
      { who: "agent", text: "Thank you, Yousif. I can see a roaming charge of twelve dinars on the third of November. Were you travelling then?" },
      { who: "customer", text: "No, I was here in Bahrain the whole month." },
      { who: "agent", text: "Understood. I've raised a billing dispute for that charge, and someone will call you back within two working days." },
      { who: "customer", text: "Okay, thanks." },
      { who: "agent", text: "So that's a dispute for the twelve dinar roaming charge, with a call back in two working days. Is there anything else I can help with?" },
      { who: "customer", text: "No, that's all." },
    ],
  },
  {
    source: "Campaign",
    simulated: true,
    handledBy: "AI",
    client: "Khidmati Service Centre",
    scenario: "Appointment reminder",
    customer: "Ali Jaffar",
    language: "ar",
    outcome: "no_answer",
    disposition: "Retry later",
    durationSecs: 0,
    summary: "No answer. The call will be retried once inside calling hours.",
    transcript: [],
  },
];

const SAMPLE_SCORE = {
  model: "sample",
  criteria: [
    { id: "greeting", result: "pass", evidence: "Thank you for calling Tylos Telecom, this is Sara." },
    { id: "identity", result: "pass", evidence: "Can I have your full name and the last four digits of your CPR?" },
    { id: "resolution", result: "pass", evidence: "I've raised a billing dispute for that charge" },
    { id: "recap", result: "pass", evidence: "So that's a dispute for the twelve dinar roaming charge, with a call back in two working days." },
    { id: "courtesy", result: "pass", evidence: "I can look into that for you." },
    { id: "closing", result: "fail", evidence: "Is there anything else I can help with? (no goodbye after the customer answered)" },
  ],
  flags: ["promised_callback"],
};

const saved = [];
for (const call of CALLS) {
  const res = await fetch(`${base}/api/queue`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(call) });
  const out = await res.json();
  if (!out.ok) throw new Error(`${res.status} ${JSON.stringify(out)}`);
  saved.push(out.call);
  console.log(`${out.call.id}  ${call.source}  ${call.client}  ${call.scenario}`);
}

if (args.includes("--scored")) {
  // The scoring function comes in a later step; until then this writes straight to the local store.
  const { saveScore } = await import("../lib/store.js");
  const target = saved.find((c) => c.source === "Copilot");
  await saveScore(target.id, SAMPLE_SCORE);
  console.log(`${target.id}  sample score attached`);
}
