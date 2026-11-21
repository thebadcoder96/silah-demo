// Real phone calls, for the two demos that have a phone number behind them.
//
//   GET  /api/phone?line=triage     the latest call to the triage number: what the agent understood, and the transcript
//   POST /api/phone?tool=<name>     called by the triage agent itself during a phone call (its tools have no browser to run in)
//   POST /api/phone                 { to, name, language }: the campaign agent rings that number
//   GET  /api/phone?id=<id>         that outbound call: status and transcript
//
// Finished calls are saved to the same queue as every other demo call, once,
// so the quality desk scores them. Reads from ElevenLabs are limited to this
// demo's own phone agents.

import AGENTS from "../lib/agents.js";
import { addCall, getLive, listCalls, setLive } from "../lib/store.js";
import { cleanCall } from "./queue.js";
import { TRIAGE } from "../data/triage.js";
import { CAMPAIGN } from "../data/campaign.js";

const KEY = () => process.env.ELEVENLABS_API_KEY;
const RECENT_SECS = 15 * 60; // a finished call stays on the page this long
const LIVE = new Set(["initiated", "in-progress"]);

async function eleven(path, body) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method: body ? "POST" : "GET",
    headers: { "xi-api-key": KEY(), "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const lines = (full) => (full.transcript || []).filter((t) => t.message).map((t) => ({ who: t.role === "user" ? "customer" : "agent", text: t.message }));

/** Save a finished call to the queue unless it is already there. Returns its reference, or "". */
async function saveOnce(conversationId, record) {
  const found = (await listCalls()).find((c) => c.conversationId === conversationId);
  if (found) return found.id;
  const cleaned = cleanCall({ ...record, conversationId });
  return cleaned.ok ? (await addCall(cleaned.call)).id : "";
}

// English lines now carry Arabic greetings, so a line is Arabic only when most of its letters are.
const mostlyArabic = (text = "") => (text.match(/[؀-ۿ]/g) || []).length > (text.match(/[a-z]/gi) || []).length;

// ---------- the triage agent's tools, on a phone call ----------

const deskOf = (id) => (id in TRIAGE.desks ? id : "cpr");
async function tool(name, p) {
  const now = (await getLive("triage")) || {};
  // A board that already ended in a transfer, or is old, belongs to an earlier call.
  const board = now.transferred || Date.now() - (now.at || 0) > 10 * 60 * 1000 ? {} : now;
  if (name === "show_triage") {
    await setLive("triage", { ...board, need: p.need || board.need || "", desk: deskOf(p.desk), urgency: ["low", "normal", "high"].includes(p.urgency) ? p.urgency : "normal", caller: p.caller_name || board.caller || "" });
    return { ok: true };
  }
  if (name === "transfer_call") {
    const id = deskOf(p.desk) === "self" ? "cpr" : deskOf(p.desk);
    await setLive("triage", { ...board, desk: id, transferred: id, summary: p.summary || board.need || "", caller: p.caller_name || board.caller || "" });
    return { transferred: true, desk: TRIAGE.desks[id].name, note: "The desk has the summary. Now do the next step in your instructions." };
  }
  return { ok: false, reason: "no such tool" };
}

// ---------- the triage number ----------

async function triageLine() {
  const out = { number: AGENTS.phone?.number || "", board: null, call: null };
  const board = await getLive("triage");
  if (board && Date.now() - board.at < RECENT_SECS * 1000) out.board = board;
  if (!KEY() || !AGENTS.triagePhoneAgentId) return { ...out, setup: KEY() ? "no phone agent yet" : "ELEVENLABS_API_KEY is not set on the server" };
  const latest = (await eleven(`/v1/convai/conversations?agent_id=${AGENTS.triagePhoneAgentId}&page_size=1`)).conversations?.[0];
  if (!latest) return out;
  const ended = latest.start_time_unix_secs + (latest.call_duration_secs || 0);
  const live = LIVE.has(latest.status);
  if (!live && Date.now() / 1000 - ended > RECENT_SECS) return out;
  const full = await eleven(`/v1/convai/conversations/${latest.conversation_id}`);
  const transcript = lines(full);
  out.call = { id: latest.conversation_id, live: LIVE.has(full.status), started: latest.start_time_unix_secs, seconds: full.metadata?.call_duration_secs || 0, messages: transcript, ref: "" };
  if (full.status === "done" && transcript.length >= 2) {
    const b = out.board || {};
    out.call.ref = await saveOnce(latest.conversation_id, {
      source: "Triage", handledBy: "AI", client: TRIAGE.client, scenario: "Main line triage (phone)", customer: b.caller || "", language: mostlyArabic(transcript[1]?.text) ? "ar" : "en",
      outcome: "answered", disposition: b.transferred ? `Transferred to the ${TRIAGE.desks[b.transferred].name}` : "Answered by the AI agent",
      summary: b.summary || full.analysis?.transcript_summary || b.need || "", durationSecs: out.call.seconds, transcript,
    });
  }
  return out;
}

// ---------- the campaign agent rings a phone ----------

const APPOINTMENT = {
  ar: { day: "يوم الأحد الساعة عشر الصبح", centre: "مركز مدينة عيسى" },
  en: { day: "Sunday at ten in the morning", centre: "the Isa Town centre" },
};

async function dial(body) {
  const to = String(body.to || "").replace(/[\s()-]/g, "");
  if (!/^\+\d{8,15}$/.test(to)) return [422, { ok: false, reason: "Give the number in international form, for example +97333001122." }];
  const language = body.language === "en" ? "en" : "ar";
  const agent = AGENTS.campaignAgentIds?.[language];
  if (!KEY() || !agent || !AGENTS.phone?.id) return [503, { ok: false, reason: !KEY() ? "The server has no ElevenLabs key yet." : "No phone number is connected yet." }];
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) return [422, { ok: false, reason: "Give the name of the person to ask for." }];
  // Arabic addresses a man and a woman differently, so the agent has to know which.
  if (!["male", "female"].includes(body.gender)) return [422, { ok: false, reason: "Choose male or female, so the agent addresses the person correctly." }];
  const gender = body.gender;
  const made = await eleven("/v1/convai/twilio/outbound-call", {
    agent_id: agent,
    agent_phone_number_id: AGENTS.phone.id,
    to_number: to,
    conversation_initiation_client_data: { dynamic_variables: { name, gender, appointment: APPOINTMENT[language].day, centre: APPOINTMENT[language].centre } },
  });
  if (!made.conversation_id) return [502, { ok: false, reason: made.message || "The call could not be placed." }];
  return [201, { ok: true, id: made.conversation_id }];
}

async function outbound(id) {
  const full = await eleven(`/v1/convai/conversations/${encodeURIComponent(id)}`);
  if (!Object.values(AGENTS.campaignAgentIds || {}).includes(full.agent_id)) return [404, { ok: false, reason: "no such call" }];
  const transcript = lines(full);
  const call = { id, status: full.status, live: LIVE.has(full.status), seconds: full.metadata?.call_duration_secs || 0, messages: transcript, summary: full.analysis?.transcript_summary || "", ref: "" };
  if (full.status === "done" || full.status === "failed") {
    const answered = transcript.some((t) => t.who === "customer");
    const vars = full.conversation_initiation_client_data?.dynamic_variables || {};
    call.ref = await saveOnce(id, {
      source: "Campaign", simulated: false, handledBy: "AI", client: CAMPAIGN.client, scenario: `${CAMPAIGN.name} (live call)`, customer: vars.name || "",
      language: mostlyArabic(transcript.find((t) => t.who !== "agent")?.text || transcript[0]?.text) ? "ar" : "en", outcome: full.status === "failed" ? "failed" : answered ? "answered" : "no_answer",
      disposition: answered ? "Live call" : "Not answered", summary: call.summary || (answered ? "" : "The call was not answered."), durationSecs: call.seconds, transcript,
    });
  }
  return [200, { ok: true, call }];
}

export default async function handler(req, res) {
  res.setHeader?.("cache-control", "no-store");
  const query = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
  let body = req.body ?? {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "body must be JSON" });
    }
  }
  try {
    if (req.method === "POST" && query.tool) return res.status(200).json(await tool(query.tool, body));
    if (req.method === "POST") {
      const [code, out] = await dial(body);
      return res.status(code).json(out);
    }
    if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
    if (query.id) {
      const [code, out] = await outbound(query.id);
      return res.status(code).json(out);
    }
    return res.status(200).json(await triageLine());
  } catch (err) {
    console.error(err);
    return res.status(502).json({ ok: false, error: "The phone service did not answer.", number: AGENTS.phone?.number || "" });
  }
}
