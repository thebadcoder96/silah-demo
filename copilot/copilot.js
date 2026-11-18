// The agent copilot. The visitor is the contact-centre agent. Two ElevenLabs
// sessions run side by side during a call:
//
//   the call   a voice session with an AI caller playing the customer. It is
//              also the transcript source: every finished line, from either
//              side, arrives through onMessage. To use another speech-to-text
//              for the agent's side, replace what feeds addLine().
//   the brain  a text-only session with the copilot agent. Each line of the
//              call is sent to it, and it answers by calling the two tools
//              below, which move this screen. It never speaks to anyone.
//
// Add ?text to the address to type instead of speaking (no microphone needed).

import { SCENARIOS, SCENARIO_LIST, callerKey, packFor } from "../data/scenarios.js";
import { FLAGS } from "../lib/scorecard.js";
import { createOrb } from "../lib/orb.js";
import { asClientTools, createVoice } from "../lib/voice.js";

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, kids = []) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of [].concat(kids)) if (k != null) n.append(k);
  return n;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const TEXT_MODE = params.has("text");
if (params.has("voicetest")) await import("./voice-test.js"); // plays recorded lines in place of the microphone
const config = window.SILAH_CONFIG || {};
const CHECKS = { greeting: "Greeting", identity: "Identity check", recap: "Recap", closing: "Closing" };

let scenario = SCENARIOS[params.get("call")] || SCENARIO_LIST[0];
let language = params.get("lang") === "en" ? "en" : "ar";
const fresh = () => ({ lines: [], startedAt: 0, endedAt: 0, identity: "none", tab: null, spot: null, flashTab: null, queuedView: null, fields: {}, checks: {}, card: null, step: null, done: [], say: "", sayEn: "", sayBefore: "", sayAt: 0, wrap: null, wrapLate: false, saved: null, saving: null, saveFailed: false, english: false, conversationId: "" });
let st = fresh();

// A call handed over by the campaign desk's AI agent arrives as ?handover=<reference>.
let handover = null;
const OWN_CALL = "You are calling the contact centre yourself.";
const TRANSFERRED = "A moment ago the centre's automated assistant phoned you with a reminder. You asked to speak to a person and have just been put through. The agent may already know why, so do not be surprised if they do.";
if (params.get("handover")) {
  fetch("/api/queue", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => { handover = j.calls?.find((c) => c.id === params.get("handover")) || null; drawLobby(); })
    .catch(() => {});
}
let phase = "lobby";
const orb = createOrb($("#orb"));

function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

/** Type text into a field a character at a time, so the agent can see the copilot working. */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Slow enough to watch, never more than about a second and a half for one value. */
const typingPause = (text) => Math.max(14, Math.min(42, 1400 / (text.length || 1)));
async function typeInto(input, text) {
  input.classList.add("filling");
  input.value = "";
  const pause = REDUCED ? 0 : typingPause(text);
  for (const ch of text) {
    input.value += ch;
    if (pause) await sleep(pause);
  }
  input.classList.remove("filling");
}

// ---------- the copilot's hand ----------
// Everything the copilot does on the client's system is acted out, so it can
// be seen working: a pointer moves to the control, clicks it, and types.
// Acts run one after another, in the order the copilot asked for them.

const hand = el("div", { className: "hand" }, [el("i"), el("span", { textContent: "Copilot" })]);
document.body.append(hand);
let acts = Promise.resolve();
let handTimer;
function act(fn) {
  acts = acts.then(fn).catch((err) => console.error(err));
}
/** Move the pointer to a control and click it. label says what the copilot is doing. */
async function pointAt(selector, label) {
  const node = document.querySelector(selector);
  if (!node || REDUCED || phase !== "live") return;
  node.scrollIntoView({ block: "nearest" });
  const r = node.getBoundingClientRect();
  clearTimeout(handTimer);
  if (!hand.classList.contains("show")) {
    // come in from the copilot's own column, not from a corner of the window
    const from = $(".col.copilot").getBoundingClientRect();
    hand.style.transition = "none";
    hand.style.transform = `translate(${from.left + 24}px, ${from.top + 60}px)`;
    hand.getBoundingClientRect();
    hand.style.transition = "";
  }
  hand.lastChild.textContent = label;
  hand.classList.add("show");
  hand.style.transform = `translate(${r.left + Math.min(r.width / 2, 90)}px, ${r.top + r.height / 2}px)`;
  await sleep(560);
  hand.classList.add("click");
  await sleep(220);
  hand.classList.remove("click");
  handTimer = setTimeout(() => hand.classList.remove("show"), 1600);
}

// ---------- lobby ----------

const agentIdFor = () => config.callerAgentIds?.[callerKey(scenario.id, language)] || "";

function drawLobby() {
  $("#scenarios").replaceChildren(
    ...SCENARIO_LIST.map((s) => {
      const b = el("button", { className: "scenario", role: "radio", ariaChecked: String(s.id === scenario.id) }, [
        el("small", { textContent: `${s.client} · ${s.sector}` }),
        el("b", { textContent: s.title }),
        el("span", { textContent: s.blurb }),
      ]);
      b.addEventListener("click", () => { scenario = s; drawLobby(); });
      return b;
    }),
  );
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.lang === language)));
  $("#handover").hidden = !handover;
  if (handover) $("#handover").replaceChildren(el("b", { textContent: `Waiting for you: ${handover.customer}, handed over by the AI agent (${handover.id})` }), el("p", { textContent: handover.summary }));
  const ready = Boolean(agentIdFor() && config.copilotAgentId);
  $("#take").disabled = !ready;
  $("#lobby-note").textContent = !ready ? "This call is not set up yet." : TEXT_MODE ? "Typing mode: you type what the agent says, and the customer answers in text." : "Uses your microphone. The customer says hello when you answer.";
}
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => { language = b.dataset.lang; drawLobby(); }));

function setPhase(next) {
  phase = next;
  document.body.dataset.phase = next;
  $("#lobby").hidden = next !== "lobby";
  $("#desk").hidden = next === "lobby";
  $("#answer").hidden = next !== "ringing";
  $("#end").hidden = next !== "live";
  $("#mute").hidden = next !== "live" || TEXT_MODE;
  $("#typed").hidden = next !== "live";
  $("#english").hidden = language !== "ar" || next === "ringing";
}

// ---------- ringing ----------

let stopRing = () => {};
function ring() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const tones = [440, 480].map((f) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      return o;
    });
    const beat = () => { gain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.02); gain.gain.setTargetAtTime(0, ctx.currentTime + 1.1, 0.02); };
    beat();
    const timer = setInterval(beat, 3000);
    stopRing = () => { clearInterval(timer); tones.forEach((o) => o.stop()); ctx.close(); stopRing = () => {}; };
  } catch {
    // no audio: the Answer button still pulses
  }
}

$("#take").addEventListener("click", () => {
  st = fresh();
  document.documentElement.style.setProperty("--accent", scenario.accent);
  $("#sys-name").textContent = scenario.client;
  $("#sys-search").value = "";
  $("#call-title").textContent = "Incoming call";
  $("#call-sub").textContent = `${scenario.client} customer line`;
  $("#timer").textContent = "0:00";
  $("#log").replaceChildren();
  $("#reason").textContent = "Listening…";
  $("#reason").className = "big muted";
  drawGuide();
  $("#nudge").hidden = true;
  $("#wrap").hidden = true;
  $("#ho").hidden = !handover;
  $("#ho-text").textContent = handover?.summary || "";
  $("#english").setAttribute("aria-pressed", "false");
  drawChecks();
  drawSystem();
  orb.setState("connecting");
  setPhase("ringing");
  ring();
});

// ---------- the call ----------

const call = createVoice({
  onStatus(s) {
    if (phase !== "live") return;
    orb.setState(s);
    $("#call-sub").textContent = { connecting: "Connecting…", listening: call.muted() ? "You are muted" : "Listening to you", speaking: "Customer is speaking", idle: "" }[s];
    if (s === "idle") endCall(); // the customer hung up, or the line dropped
  },
  onMessage: (who, text) => (who === "note" ? toast(text) : addLine(who === "user" ? "agent" : "customer", text)),
});
orb.setLevel(() => Math.max(call.levels().input, call.levels().output));

$("#answer").addEventListener("click", async () => {
  if (phase !== "ringing") return;
  stopRing();
  setPhase("live");
  st.startedAt = Date.now();
  $("#call-title").textContent = "Customer";
  note("Call started");
  startBrain();
  const ok = await call.start({ agentId: agentIdFor(), textOnly: TEXT_MODE, dynamicVariables: { context: handover ? TRANSFERRED : OWN_CALL } });
  if (!ok) return backToLobby();
  st.conversationId = call.id();
  if (TEXT_MODE) $("#call-sub").textContent = "Typing mode";
});

setInterval(() => {
  if (phase !== "live") return;
  const s = Math.floor((Date.now() - st.startedAt) / 1000);
  $("#timer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}, 500);

function setMuted(on) {
  const muted = call.mute(on);
  $("#mute").setAttribute("aria-pressed", String(muted));
  $("#mute").setAttribute("aria-label", muted ? "Unmute microphone" : "Mute microphone");
  $("#mute").title = muted ? "Unmute" : "Mute";
  $("#call-sub").textContent = muted ? "You are muted" : "Listening to you";
}
$("#mute").addEventListener("click", () => setMuted(!call.muted()));
$("#end").addEventListener("click", () => endCall());
$("#typed").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#typed-input").value.trim();
  if (!text || !call.send(text)) return;
  $("#typed-input").value = "";
  addLine("agent", text);
});
$("#english").addEventListener("click", () => {
  st.english = !st.english;
  $("#english").setAttribute("aria-pressed", String(st.english));
  $("#log").querySelectorAll(".turn").forEach((n) => n.remove());
  st.lines.forEach(drawLine);
  drawGuide();
});

// ---------- transcript ----------

function note(text) {
  $("#log").append(el("div", { className: "note", textContent: text }));
}

function drawLine(line) {
  const old = document.getElementById(`line-${line.id}`);
  const node = el("div", { id: `line-${line.id}`, className: `turn ${line.who}` }, [
    el("small", { textContent: line.who === "agent" ? "You" : scenario.customer.name }),
    el("p", { textContent: line.text }),
    st.english && line.en ? el("p", { className: "en", textContent: line.en }) : null,
  ]);
  if (old) old.replaceWith(node);
  else $("#log").append(node);
  $("#log").scrollTop = $("#log").scrollHeight;
}

/** Every finished line of the call lands here, whoever said it and however it was transcribed. */
function addLine(who, text) {
  text = String(text || "").trim();
  if (!text || phase !== "live") return;
  const line = { id: `L${st.lines.length + 1}`, who, text, en: "" };
  st.lines.push(line);
  drawLine(line);
  feed(`[${line.id}] ${who === "agent" ? "AGENT" : "CUSTOMER"}: ${text}`);
}

// ---------- the brain ----------

let pending = [];
let busy = false;
let busyTimer;
function release() {
  clearTimeout(busyTimer);
  busy = false;
  pump();
}
function pump() {
  if (busy || !pending.length || !brain.active()) return;
  busy = true;
  brain.send(pending.splice(0).join("\n"));
  busyTimer = setTimeout(release, 15000); // never wait for ever on one answer
}
function feed(text) {
  pending.push(text);
  pump();
}
async function startBrain() {
  pending = [];
  busy = false;
  await brain.start({
    agentId: config.copilotAgentId,
    textOnly: true,
    dynamicVariables: { client: scenario.client, language: language === "ar" ? "Bahraini Arabic (the agent may mix in English)" : "English", pack: packFor(scenario) },
  });
  if (handover) pending.unshift(`[NOTE] This call was handed over by the centre's AI agent after an outbound reminder call. Its summary: ${handover.summary}`);
  pump();
}

// ---------- the brain's tools: these move the screen ----------

/**
 * Show a new line to say. The one on screen stays long enough to be read out
 * (longer for a longer line), and then moves down as "Before" instead of vanishing.
 */
let sayTimer;
function suggest(text, en) {
  if (text === st.say) return;
  const call = st;
  const wait = st.say ? Math.min(10000, Math.max(4500, st.say.length * 75)) - (Date.now() - st.sayAt) : 0;
  clearTimeout(sayTimer);
  const show = () => {
    if (st !== call) return;
    st.sayBefore = st.say;
    st.say = text;
    st.sayEn = en;
    st.sayAt = Date.now();
    drawGuide();
  };
  if (wait <= 0) show();
  else sayTimer = setTimeout(show, wait);
}

async function update_screen(p) {
  const out = { ok: true };
  for (const t of p.translations || []) {
    const line = st.lines.find((l) => l.id === t.line);
    if (line && t.en) { line.en = t.en; drawLine(line); }
  }
  if (p.call_reason) {
    $("#reason").textContent = p.call_reason;
    $("#reason").className = "big";
  }
  if (p.customer_search) out.customer_record = search(p.customer_search);
  if (p.show_tab || p.highlight_row) out.screen = view(p.show_tab, p.highlight_row);
  if (p.knowledge_card) {
    if (scenario.kb.some((k) => k.id === p.knowledge_card)) st.card = p.knowledge_card;
    else out.knowledge = { shown: false, reason: "No such card." };
  }
  if (Array.isArray(p.steps_done)) st.done = p.steps_done.map(Number);
  if (p.current_step !== undefined) st.step = Number(p.current_step);
  if (p.say_next) suggest(p.say_next, p.say_next_en || "");
  drawGuide();
  if (p.nudge !== undefined) {
    $("#nudge").textContent = p.nudge;
    $("#nudge").hidden = !p.nudge;
  }
  for (const c of p.checklist || []) if (c.item in CHECKS) st.checks[c.item] = c.evidence || "";
  if (p.checklist?.length) drawChecks();
  if (p.form_fields?.length) out.form = propose(p.form_fields);
  return out;
}

function finish_call(p) {
  st.wrap = {
    summary: p.summary || "",
    disposition: p.disposition || "",
    title: p.ticket_title || "",
    flags: (p.flags || []).filter((f) => f in FLAGS),
    scorecard: p.scorecard || [],
  };
  drawWrap();
  return { ok: true };
}

const TOOLS = { update_screen, finish_call };
const brain = createVoice({
  clientTools: asClientTools(TOOLS),
  onMessage: (who) => who === "agent" && release(), // its "ok" means it is ready for the next lines
});

// ---------- the client's system ----------

function search(query) {
  const c = scenario.customer;
  const q = query.toLowerCase();
  const names = [...c.name.toLowerCase().split(" "), ...c.nameAr.split(" ")].filter((w) => w.length > 2);
  const hit = names.some((w) => q.includes(w)) || q.replace(/\D/g, "").includes(c.cprLast4) || q.includes(c.account.toLowerCase());
  act(async () => {
    await pointAt("#sys-search", "Searching");
    await typeInto($("#sys-search"), query);
    if (!hit) {
      if (st.identity === "none") $("#sys-body").replaceChildren(el("p", { className: "hint", textContent: `No customer matched “${query}”.` }));
      return;
    }
    if (st.identity === "none") st.identity = "found";
    drawSystem();
  });
  if (!hit) return { found: false, note: "No customer matched. The agent should ask for the name and CPR digits again." };
  return {
    found: true,
    name: c.name,
    cpr_last_four: c.cprLast4,
    account: c.account,
    about: c.detail,
    identity_confirmed_by_agent: st.identity === "confirmed",
    note: st.identity === "confirmed" ? "The record is open." : "The match is on screen. The record opens when the agent presses Confirm identity; you can already choose the tab, row and form fields.",
  };
}

function view(tabId, rowId) {
  const tab = scenario.tabs.find((t) => t.id === tabId) || scenario.tabs.find((t) => t.rows.some((r) => r.id === rowId));
  if (!tab) return { shown: false, reason: "No such tab or row." };
  const row = tab.rows.find((r) => r.id === rowId)?.id || null;
  if (st.identity !== "confirmed") {
    st.queuedView = { tab: tab.id, row };
    return { shown: false, reason: "Queued. It opens when the agent confirms the customer's identity." };
  }
  act(async () => {
    if (st.identity !== "confirmed") return;
    if (st.tab !== tab.id) {
      await pointAt(`#tab-${tab.id}`, `Opening ${tab.title}`);
      st.flashTab = tab.id;
      st.tab = tab.id;
      st.spot = null;
      drawSystem();
      await sleep(REDUCED ? 0 : 300);
    }
    if (row && st.spot !== row) await pointAt(`#row-${row}`, "This is the one");
    st.spot = row;
    drawSystem();
  });
  return { shown: true, tab: tab.id, row };
}

function confirmIdentity() {
  st.identity = "confirmed";
  st.tab = scenario.tabs[0].id;
  st.spot = null;
  $("#nudge").hidden = true; // the usual warning at this point is "confirm identity first"
  drawSystem();
  if (st.queuedView) view(st.queuedView.tab, st.queuedView.row); // what the copilot had lined up, now acted out
  st.queuedView = null;
  feed("[NOTE] The agent pressed Confirm identity. The customer's record is now open on the agent's screen.");
}

function propose(fields) {
  const taken = [];
  for (const f of fields) {
    if (!scenario.form.fields.some((x) => x.id === f.field) || !f.value) continue;
    if (st.fields[f.field]?.status === "approved") continue; // never overwrite what the agent approved
    st.fields[f.field] = { value: String(f.value), heard: f.heard || "", status: "proposed", typing: true, shown: "" };
    taken.push(f.field);
  }
  drawCase();
  const call = st;
  act(async () => {
    for (const id of taken) {
      const f = call.fields[id];
      if (!f?.typing || st !== call) continue;
      await pointAt(`#f-${id}`, `Filling ${scenario.form.fields.find((d) => d.id === id).label}`);
      const pause = REDUCED ? 0 : typingPause(f.value);
      for (const ch of f.value) {
        f.shown += ch;
        const input = document.getElementById(`f-${id}`);
        if (input?.readOnly) input.value = f.shown;
        if (pause) await sleep(pause);
      }
      f.typing = false;
      if (st === call) drawCase();
    }
  });
  return { proposed: taken, note: "Shown as proposals. Nothing is saved until the agent approves." };
}

/** Tell the brain what the agent approved on screen, so a click can finish a step just as a spoken line can. */
function tellApproved() {
  clearTimeout(tellApproved.timer);
  tellApproved.timer = setTimeout(() => {
    if (phase !== "live") return;
    const done = scenario.form.fields.filter((d) => st.fields[d.id]?.status === "approved").map((d) => `${d.label}: ${st.fields[d.id].value}`);
    if (done.length) feed(`[NOTE] The agent approved these case form fields on screen: ${done.join("; ")}. ${done.length === scenario.form.fields.length ? "The case form is complete." : ""}`);
  }, 700);
}

let caseDirty = false;
function drawCase() {
  const box = document.getElementById("case");
  if (!box) return;
  if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && !document.activeElement.readOnly) return void (caseDirty = true); // the agent is typing: wait
  caseDirty = false;
  const open = Object.values(st.fields).filter((f) => f.status === "proposed").length;
  const all = el("button", { className: "ghost", textContent: "Approve all", hidden: open < 2 });
  all.addEventListener("click", () => { for (const f of Object.values(st.fields)) f.status = "approved"; drawCase(); tellApproved(); });
  box.replaceChildren(
    el("h3", {}, [scenario.form.title, all]),
    ...scenario.form.fields.map((def) => {
      const f = st.fields[def.id];
      const input = el("input", { id: `f-${def.id}`, value: (f?.typing ? f.shown : f?.value) || "", readOnly: true, ariaLabel: def.label });
      const settle = () => { st.fields[def.id] = { ...(st.fields[def.id] || { heard: "" }), value: input.value.trim(), status: input.value.trim() ? "approved" : undefined }; if (!input.value.trim()) delete st.fields[def.id]; drawCase(); tellApproved(); };
      input.addEventListener("keydown", (e) => e.key === "Enter" && input.blur());
      input.addEventListener("blur", () => !input.readOnly && settle());
      const approve = el("button", { className: "ghost approve", textContent: "Approve" });
      approve.addEventListener("click", () => { f.status = "approved"; drawCase(); tellApproved(); });
      const edit = el("button", { className: "ghost", textContent: "Edit" });
      edit.addEventListener("click", () => { input.readOnly = false; input.focus(); input.select(); });
      return el("div", { className: `field ${f?.status || ""} ${f?.typing ? "typing" : ""}` }, [
        el("label", { htmlFor: input.id, textContent: def.label }),
        input,
        el("div", { className: "acts" }, f?.status === "approved" ? [el("span", { className: "ok", textContent: "✓ Approved" }), edit] : f && !f.typing ? [approve, edit] : [edit]),
        f?.heard && f.status === "proposed" && !f.typing ? el("span", { className: "heard", textContent: `Heard: “${f.heard}”` }) : null,
      ]);
    }),
  );
}
document.addEventListener("focusout", () => setTimeout(() => caseDirty && drawCase(), 0));

function drawSystem() {
  const c = scenario.customer;
  const body = $("#sys-body");
  if (st.identity === "none") return body.replaceChildren(el("p", { className: "hint", textContent: "The customer's record opens here once they say who they are." }));
  const confirm = el("button", { className: "primary", textContent: "Confirm identity" });
  confirm.addEventListener("click", confirmIdentity);
  const match = el("div", { className: `match ${st.identity === "confirmed" ? "ok" : ""}` }, [
    el("div", {}, [el("b", { textContent: c.name }), el("span", { textContent: `CPR ending ${c.cprLast4} · ${c.account} · ${c.detail}` })]),
    st.identity === "confirmed" ? el("span", { className: "tick", textContent: "✓ Identity confirmed by you" }) : confirm,
  ]);
  const parts = [match];
  if (st.identity === "confirmed") {
    const tab = scenario.tabs.find((t) => t.id === st.tab) || scenario.tabs[0];
    parts.push(
      el("div", {}, [
        el("div", { className: "tabs", role: "tablist" }, scenario.tabs.map((t) => {
          const b = el("button", { id: `tab-${t.id}`, role: "tab", className: [t.id === tab.id ? "on" : "", t.id === st.flashTab ? "flash" : ""].join(" ").trim(), textContent: t.title });
          b.addEventListener("click", () => { st.tab = t.id; drawSystem(); });
          return b;
        })),
        el("table", {}, [
          el("thead", {}, el("tr", {}, tab.columns.map((h) => el("th", { textContent: h })))),
          el("tbody", {}, tab.rows.map((r) => el("tr", { id: `row-${r.id}`, className: r.id === st.spot ? "spot" : "" }, r.cells.map((v, n) => el("td", {}, [r.id === st.spot && n === 0 ? el("span", { className: "cp", textContent: "Copilot" }) : null, v]))))),
        ]),
      ]),
    );
  } else {
    parts.push(el("p", { className: "fine", textContent: "Check the name and CPR digits with the customer, then confirm. Nothing is opened on a match alone." }));
  }
  parts.push(el("div", { id: "case", className: "case" }));
  body.replaceChildren(...parts);
  st.flashTab = null;
  drawCase();
  document.getElementById(`row-${st.spot}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ---------- the copilot's panel ----------

function sayBox() {
  if (!st.say) return null;
  return el("div", { className: "saybox" }, [
    el("small", { textContent: "Say" }),
    el("p", { className: "say", textContent: st.say }),
    st.english && st.sayEn ? el("p", { className: "say-en", textContent: st.sayEn }) : null,
    st.sayBefore ? el("p", { className: "say-before" }, [el("b", { textContent: "Before: " }), st.sayBefore]) : null,
  ]);
}

/** One place to look: the procedure for this call, where the agent is in it, and what to say now. */
function drawGuide() {
  const card = scenario.kb.find((k) => k.id === st.card);
  if (!card) return $("#guide").replaceChildren(sayBox() || el("p", { className: "muted", textContent: "Listening…" }));
  // If the brain has not said which step is next, it is the first one not yet done.
  const firstOpen = card.body.findIndex((_, i) => !st.done.includes(i + 1)) + 1;
  const now = st.step === 0 ? 0 : st.step && !st.done.includes(st.step) ? st.step : firstOpen;
  $("#guide").replaceChildren(...[
    el("h3", { textContent: card.title }),
    el("ol", { className: "steps" }, card.body.map((text, i) => {
      const n = i + 1;
      const state = st.done.includes(n) ? "done" : n === now ? "now" : "";
      return el("li", { className: state }, [el("span", { textContent: text }), state === "now" ? sayBox() : null]);
    })),
    now === 0 ? el("p", { className: "alldone", textContent: "Every step is done." }) : null,
    now === 0 ? sayBox() : null,
    card.caution ? el("p", { className: "caution", textContent: card.caution }) : null,
  ].filter(Boolean));
  $("#guide .now")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function drawChecks() {
  $("#checklist").replaceChildren(
    ...Object.entries(CHECKS).map(([id, label]) =>
      el("li", { className: id in st.checks ? "done" : "" }, [el("span", { textContent: label }), st.checks[id] ? el("q", { textContent: st.checks[id] }) : null]),
    ),
  );
}

// ---------- after the call ----------

function endCall() {
  if (phase !== "live") return;
  st.endedAt = Date.now();
  setPhase("wrap");
  call.end();
  orb.setState("idle");
  $("#call-title").textContent = "Call ended";
  $("#call-sub").textContent = "";
  note("Call ended");
  $("#nudge").hidden = true;
  if (!st.lines.length) return backToLobby();
  feed("CALL ENDED");
  drawWrap();
  setTimeout(() => { if (phase === "wrap" && !st.wrap) { st.wrapLate = true; drawWrap(); } }, 30000);
}

function drawWrap() {
  const box = $("#wrap");
  box.hidden = false;
  const again = el("button", { className: "primary", textContent: "Take another call" });
  again.addEventListener("click", backToLobby);
  if (!st.wrap && !st.wrapLate) return box.replaceChildren(el("h2", { textContent: "Wrap-up" }), el("p", { className: "muted", textContent: "Writing the summary…" }));
  const w = st.wrap || { summary: "", disposition: "", title: "", flags: [], scorecard: [] };
  if (!st.saved && !st.saving) save(w); // nothing to press: the call goes to the quality desk as soon as it is written up
  const approved = Object.values(st.fields).filter((f) => f.status === "approved").length;
  const retry = el("button", { className: "ghost", textContent: "Try again" });
  retry.addEventListener("click", () => { st.saveFailed = false; st.saving = null; drawWrap(); });
  box.replaceChildren(...[
    el("h2", { textContent: "Wrap-up" }),
    st.saved ? el("p", { className: "ref", textContent: st.saved.id }) : null,
    el("p", { className: "fine", textContent: st.saved ? (st.saved.scored ? "Saved. The call and its scorecard are on the quality desk." : "Saved. The quality desk will score it.") : st.saveFailed ? "The call could not be saved. Nothing was sent." : "Saving to the quality desk…" }),
    w.title ? el("p", { className: "big", textContent: w.title }) : null,
    w.summary ? el("p", { className: "text", textContent: w.summary }) : st.wrap ? null : el("p", { className: "text", textContent: "The copilot did not finish the summary in time. The transcript was saved without one." }),
    el("div", { className: "chips" }, [
      w.disposition ? el("span", { className: "chip", textContent: w.disposition }) : null,
      el("span", { className: "chip", textContent: `${approved} of ${scenario.form.fields.length} case fields approved` }),
      ...w.flags.map((f) => el("span", { className: "chip warn", textContent: FLAGS[f] })),
    ]),
    el("div", { className: "actions" }, [st.saveFailed ? retry : null, again, st.saved ? el("a", { href: "../quality/", target: "silah-quality", textContent: "Open the quality desk →" }) : null]),
  ].filter(Boolean));
  box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/** The call as the queue wants it. */
function record(w) {
  return {
    source: "Copilot",
    handledBy: "Human",
    client: scenario.client,
    scenario: scenario.title,
    customer: scenario.customer.name,
    language,
    outcome: "answered",
    disposition: w.disposition,
    summary: [w.title, w.summary].filter(Boolean).join(". ").replace(/\.\. /g, ". "),
    durationSecs: Math.round(((st.endedAt || Date.now()) - st.startedAt) / 1000),
    flags: w.flags,
    transcript: st.lines.map(({ who, text, en }) => ({ who, text, en })),
    conversationId: st.conversationId,
    handoverFrom: handover?.id,
  };
}

/** Save the call to the queue, then its scorecard. Never shows a reference the queue did not give. */
function save(w) {
  const post = async (url, body) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json();
    if (!res.ok || !out.ok) throw new Error(out.reason || out.error || res.status);
    return out;
  };
  st.saving = (async () => {
    try {
      const { call: saved } = await post("/api/queue", record(w));
      const scored = w.scorecard.length ? await post(`/api/queue?score=${saved.id}`, { model: "Copilot", criteria: w.scorecard, flags: w.flags }).then(() => true, () => false) : false;
      st.saved = { id: saved.id, scored };
    } catch (err) {
      console.error(err);
      st.saveFailed = true;
    }
    st.saving = st.saveFailed ? true : null; // after a failure, wait for "Try again"
    if (phase === "wrap") drawWrap();
  })();
}

function backToLobby() {
  stopRing();
  call.end();
  brain.end();
  orb.setState("idle");
  setPhase("lobby");
  drawLobby();
}

// Closing the tab mid-call must not lose the call: send what there is, and the quality desk scores it.
addEventListener("pagehide", () => {
  if ((phase === "live" || phase === "wrap") && st.lines.length > 1 && !st.saved && !st.saving) {
    st.saving = true;
    navigator.sendBeacon("/api/queue", new Blob([JSON.stringify(record({ summary: "", disposition: "Ended without a wrap-up", title: "", flags: [] }))], { type: "application/json" }));
  }
  call.end();
  brain.end();
});
window.silahCopilot = { tools: TOOLS, addLine, state: () => st }; // for testing from the console
drawLobby();
setPhase("lobby");
