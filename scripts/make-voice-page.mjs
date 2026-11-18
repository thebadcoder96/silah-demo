// Builds voices.html: a page to listen to candidate voices for the demo agents
// and mark the ones to use.
//   node scripts/make-voice-page.mjs
// Reads ELEVENLABS_API_KEY from .env. The page itself holds no key, only the
// voices' public sample clips. Open it at http://localhost:5174/voices.html.
//
// ElevenLabs has no "Bahraini" accent label, so this lists the nearest ones.
// Each clip is the voice's own Arabic sample in that accent, not our script.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const key = (await readFile(`${root}.env`, "utf8")).match(/^\s*ELEVENLABS_API_KEY\s*=\s*"?([^"\r\n]+)/m)?.[1].trim();
const get = async (path) => {
  const res = await fetch(`https://api.elevenlabs.io${path}`, { headers: { "xi-api-key": key } });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
};

// Accent labels as the voice library spells them, nearest to Bahraini first, and how many of each to list.
const ACCENTS = [
  ["Gulf", ["gulf", "ar-gulf", "bahraini", "khaleeji"], 30],
  ["Kuwaiti", ["kuwaiti"], 12],
  ["Saudi", ["saudi"], 12],
  ["Omani, Emirati and Qatari", ["omani", "emirati", "qatari"], 8],
];
// Calm English voices already used on the Montgomery demos, for the English callers.
const ENGLISH = ["cjVigY5qzO86Huf0OWal", "cuTixVvCOWFxeH3oGE9m", "J3Ei0Lj6fAobhIqY5ySH"];

const groups = [];
const taken = new Set();
for (const [title, labels, max] of ACCENTS) {
  const found = [];
  for (const accent of labels) {
    const page = await get(`/v1/shared-voices?language=ar&accent=${encodeURIComponent(accent)}&sort=usage_character_count_1y&page_size=${max}`);
    for (const v of page.voices || []) {
      // The sample recorded in this accent, on the newest model that has one.
      const clips = (v.verified_languages || []).filter((l) => l.language === "ar" && l.preview_url && labels.includes(l.accent));
      const clip = clips.find((l) => /^eleven_v4$|v3/.test(l.model_id)) || clips[0];
      if (!clip || taken.has(v.voice_id)) continue;
      taken.add(v.voice_id);
      found.push({ id: v.voice_id, name: v.name.trim(), gender: v.gender, tags: [v.age, clip.accent.replace(/^ar-/, ""), v.descriptive, v.use_case].filter(Boolean), clip: clip.preview_url, model: clip.model_id, uses: v.usage_character_count_1y || 0 });
    }
  }
  found.sort((a, b) => b.uses - a.uses);
  if (found.length) groups.push([`Arabic · ${title}`, found.slice(0, max)]);
}

const english = [];
for (const id of ENGLISH) {
  try {
    const v = await get(`/v1/voices/${id}`);
    english.push({ id, name: v.name.trim(), gender: v.labels?.gender, tags: [v.labels?.age, v.labels?.accent, v.labels?.descriptive].filter(Boolean), clip: v.preview_url, model: "", uses: 0 });
  } catch {
    // not on the account, or the key cannot read voices: leave it out
  }
}
if (english.length) groups.push(["English", english]);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const card = (v) => `
    <article class="voice" data-id="${v.id}" data-name="${esc(v.name)}">
      <p class="tag">${esc([v.gender, ...v.tags].filter(Boolean).join(" · ").replace(/_/g, " "))}</p>
      <h3>${esc(v.name)}</h3>
      <audio controls preload="none" src="${esc(v.clip)}"></audio>
      <div class="picks">
        <button data-pick="campaign">Campaign agent</button>
        <button data-pick="caller">Caller</button>
      </div>
    </article>`;
const count = groups.reduce((n, [, list]) => n + list.length, 0);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voice picker | MM Intelligence demo</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Space+Mono&display=swap">
<style>
  :root { --bg: #0f0f0f; --card: #141414; --fg: #fafafa; --muted: #a6a6a6; --line: #1e1e30; --violet: #6335ed; --lav: #a78bfa; color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 Outfit, system-ui, sans-serif; padding: 28px max(16px, env(safe-area-inset-right, 0px)) 120px max(16px, env(safe-area-inset-left, 0px)); }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: clamp(26px, 4vw, 40px); margin: 0 0 6px; letter-spacing: -.02em; }
  .lead { color: var(--muted); margin: 0 0 8px; max-width: 70ch; }
  h2 { font: 12px "Space Mono", monospace; letter-spacing: .15em; text-transform: uppercase; color: var(--lav); margin: 34px 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  .voice { background: var(--card); border: 0.56px solid var(--line); padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .voice h3 { margin: 0; font-size: 18px; font-weight: 600; }
  .tag { margin: 0; font: 11px "Space Mono", monospace; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  audio { width: 100%; height: 36px; margin: 6px 0; }
  .picks { display: flex; gap: 8px; flex-wrap: wrap; }
  button { font: 12px "Space Mono", monospace; text-transform: uppercase; letter-spacing: .05em; background: none; color: var(--muted); border: 0.56px solid var(--line); padding: 8px 12px; cursor: pointer; }
  button:hover { color: var(--fg); border-color: rgba(99, 53, 237, .6); }
  button[aria-pressed="true"] { background: rgba(99, 53, 237, .25); border-color: var(--violet); color: #fff; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; background: #141414; border-top: 0.56px solid rgba(99, 53, 237, .4); padding: 12px max(16px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
  .bar p { margin: 0; flex: 1 1 300px; min-width: 0; font-size: 14px; }
  .bar b { color: var(--lav); font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>Pick the voices</h1>
  <p class="lead">Each clip is the voice's own sample, not our script, so judge the accent and the tone. Mark one calm voice for the campaign agent and up to three for the callers, then copy your picks to me.</p>
${groups.map(([title, list]) => `\n  <h2>${esc(title)}</h2>\n  <div class="grid">${list.map(card).join("")}\n  </div>`).join("")}
</main>
<div class="bar"><p id="summary"></p><button id="copy">Copy my picks</button></div>
<script>
  const LIMIT = { campaign: 1, caller: 3 };
  const LABEL = { campaign: "Campaign agent", caller: "Callers" };
  let picks = { campaign: [], caller: [] };
  try { picks = { ...picks, ...JSON.parse(localStorage.getItem("silah-voice-picks") || "{}") }; } catch {}
  const text = () => Object.keys(LABEL).map((k) => LABEL[k] + ": " + (picks[k].map((p) => p.name + " (" + p.id + ")").join(", ") || "not picked")).join(" | ");
  function draw() {
    document.querySelectorAll("[data-pick]").forEach((b) => b.setAttribute("aria-pressed", String(picks[b.dataset.pick].some((p) => p.id === b.closest(".voice").dataset.id))));
    const summary = document.getElementById("summary");
    summary.replaceChildren(...Object.keys(LABEL).flatMap((k, i) => {
      const b = document.createElement("b");
      b.textContent = picks[k].map((p) => p.name).join(", ") || "not picked";
      return [(i ? "  ·  " : "") + LABEL[k] + ": ", b];
    }));
    try { localStorage.setItem("silah-voice-picks", JSON.stringify(picks)); } catch {}
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    const v = b.closest(".voice");
    const list = picks[b.dataset.pick];
    const at = list.findIndex((p) => p.id === v.dataset.id);
    if (at >= 0) list.splice(at, 1);
    else {
      list.push({ id: v.dataset.id, name: v.dataset.name });
      if (list.length > LIMIT[b.dataset.pick]) list.shift();
    }
    draw();
  });
  document.addEventListener("play", (e) => document.querySelectorAll("audio").forEach((a) => a !== e.target && a.pause()), true);
  document.getElementById("copy").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(text()); e.target.textContent = "Copied"; } catch { prompt("Copy this:", text()); }
    setTimeout(() => (e.target.textContent = "Copy my picks"), 1500);
  });
  draw();
</script>
</body>
</html>
`;
await writeFile(`${root}voices.html`, html);
console.log(`voices.html written with ${count} voices:`);
for (const [title, list] of groups) console.log(`  ${title}: ${list.length}`);
