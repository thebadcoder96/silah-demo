// The demo's call queue, read by the quality desk.
//   GET    /api/queue     every call, newest first, each with its score
//   POST   /api/queue     save a finished call; returns its reference number
//   POST   /api/queue?score=SIL-1004   attach (or replace) the score for a call
//   DELETE /api/queue     empty the queue (demo reset)
// Every call here is fictional: made-up clients, customers and numbers.

import { CRITERIA, FLAGS } from "../lib/scorecard.js";
import { addCall, clearCalls, getCall, isStoreError, listCalls, saveScore } from "../lib/store.js";

export const SOURCES = ["Copilot", "Campaign", "Triage"];
// The same outcome names the ElevenLabs calling API returns, so real and simulated calls look alike.
export const OUTCOMES = ["answered", "voicemail", "busy", "no_answer", "failed"];

const text = (v, max) => String(v ?? "").trim().slice(0, max);
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/** Tidy an incoming call into the one record shape. Returns { ok, call } or { ok: false, reason }. */
export function cleanCall(input = {}) {
  if (!SOURCES.includes(input.source)) return { ok: false, reason: `source must be one of: ${SOURCES.join(", ")}` };
  const transcript = (Array.isArray(input.transcript) ? input.transcript : [])
    .slice(0, 400)
    .map((t) => ({ who: oneOf(t?.who, ["agent", "customer"], "customer"), text: text(t?.text, 2000), en: text(t?.en, 2000) || undefined }))
    .filter((t) => t.text);
  const summary = text(input.summary, 2000);
  if (!transcript.length && !summary) return { ok: false, reason: "a call needs a transcript or a summary" };
  return {
    ok: true,
    call: {
      source: input.source,
      simulated: Boolean(input.simulated),
      handledBy: oneOf(input.handledBy, ["AI", "Human"], input.source === "Copilot" ? "Human" : "AI"),
      client: text(input.client, 80),
      scenario: text(input.scenario, 120),
      customer: text(input.customer, 80),
      language: oneOf(input.language, ["ar", "en"], "en"),
      outcome: oneOf(input.outcome, OUTCOMES, "answered"),
      disposition: text(input.disposition, 120),
      summary,
      durationSecs: Math.max(0, Math.min(36000, Math.round(Number(input.durationSecs) || 0))),
      flags: [...new Set(Array.isArray(input.flags) ? input.flags : [])].filter((f) => f in FLAGS),
      transcript,
      conversationId: text(input.conversationId, 80) || undefined,
      handoverFrom: text(input.handoverFrom, 20) || undefined,
      // Recorded lines, one file per transcript line. Only this site's own campaign recordings are accepted.
      audio: /^\/campaign\/audio\/\d+\/$/.test(input.audio || "") ? input.audio : undefined,
    },
  };
}

/** Tidy an incoming score. Returns { ok, score } or { ok: false, reason }. */
export function cleanScore(input = {}) {
  const criteria = (Array.isArray(input.criteria) ? input.criteria : [])
    .filter((c) => CRITERIA.some((k) => k.id === c?.id))
    .map((c) => ({ id: c.id, result: oneOf(c.result, ["pass", "fail", "unknown"], "unknown"), evidence: text(c.evidence, 400) }));
  if (!criteria.length) return { ok: false, reason: "a score needs at least one known criterion" };
  return { ok: true, score: { model: text(input.model, 60), criteria, flags: [...new Set(Array.isArray(input.flags) ? input.flags : [])].filter((f) => f in FLAGS) } };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json({ calls: await listCalls() });
    if (req.method === "DELETE") {
      await clearCalls();
      return res.status(200).json({ cleared: true });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
    let body = req.body ?? {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body || "{}");
      } catch {
        return res.status(400).json({ error: "body must be JSON" });
      }
    }
    const scoreFor = req.query?.score ?? new URL(req.url, "http://x").searchParams.get("score");
    if (scoreFor) {
      const cleaned = cleanScore(body);
      if (!cleaned.ok) return res.status(422).json(cleaned);
      if (!(await getCall(scoreFor))) return res.status(404).json({ ok: false, reason: "no such call" });
      return res.status(201).json({ ok: true, score: await saveScore(scoreFor, cleaned.score) });
    }
    const cleaned = cleanCall(body);
    if (!cleaned.ok) return res.status(422).json(cleaned);
    return res.status(201).json({ ok: true, call: await addCall(cleaned.call) });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: isStoreError(err) ? "The demo queue could not save or read calls. Check the project's Blob store." : "Something went wrong." });
  }
}
