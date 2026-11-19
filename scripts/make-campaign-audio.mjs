// Records the campaign desk's simulated calls, so they can be listened to on
// the campaign desk and the quality desk: one mp3 per line of each transcript,
// with one voice for the AI agent and another for the customer.
//   node scripts/make-campaign-audio.mjs            every call that has no audio yet
//   node scripts/make-campaign-audio.mjs --all      record everything again
// Writes campaign/audio/<lead number>/<line number>.mp3. These files are part
// of the site, so commit them. Run it again after changing data/campaign.js.
//
// The calls are simulated: these are ElevenLabs voices reading transcripts
// written ahead of time, not recordings of real calls.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LEADS } from "../data/campaign.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const key = (await readFile(`${root}.env`, "utf8")).match(/^\s*ELEVENLABS_API_KEY\s*=\s*"?([^"\r\n]+)/m)?.[1].trim();
const again = process.argv.includes("--all");

const MODEL = "eleven_v4_turbo";
// The AI agent is Salim in both languages, as on the live campaign agent. The
// customers take turns through a pool of voices, so a list of twelve people
// does not sound like two.
const AGENT = "Dh7ijKbaKhas3blqwrt3"; // Salim
const POOL = {
  ar: { male: ["cFUFIbKkO2iZFwS8cRnY" /* Nasser AlJubaily */, "TfevL8tqOhb9PBTrfU9u" /* Sahl */, "3GnbqfjaW8xI6hRTVx4Y" /* Nasser, enterprise */], female: ["albaa6OioIhKtKdCEkQw" /* Laloosh */, "oOucsh1OZElozgDVjcfe" /* Rafoush */] },
  en: { male: ["cjVigY5qzO86Huf0OWal" /* Eric */, "iP95p4xoKVk53GoZ742B" /* Chris */, "nPczCjzI2devNBz1zQrb" /* Brian */], female: ["EXAVITQu4vr4xnSDxMaL" /* Sarah */, "cuTixVvCOWFxeH3oGE9m" /* Clara */, "cgSgspJ2msm6clMCkdW9" /* Jessica */] },
};
const turn = {}; // how many customers of each language and gender so far
const customerVoice = (lead) => {
  const pool = POOL[lead.language][lead.gender], k = lead.language + lead.gender;
  return pool[(turn[k] = (turn[k] ?? -1) + 1) % pool.length];
};

async function speak(voice, text) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL }),
      signal: AbortSignal.timeout(60000),
    }).catch((err) => ({ ok: false, status: 0, text: async () => String(err) }));
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (attempt >= 3) throw new Error(`text to speech -> ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

let made = 0;
for (const [i, lead] of LEADS.entries()) {
  if (!lead.transcript.length) continue;
  const customer = customerVoice(lead);
  const dir = `${root}campaign/audio/${i + 1}`;
  await mkdir(dir, { recursive: true });
  for (const [n, line] of lead.transcript.entries()) {
    const file = `${dir}/${n + 1}.mp3`;
    if (!again && (await stat(file).catch(() => null))) continue;
    const voice = line.who === "agent" ? AGENT : customer;
    await writeFile(file, await speak(voice, line.text));
    made++;
    console.log(`${i + 1}/${n + 1}.mp3  ${lead.name}  ${line.who}`);
  }
}
console.log(`${made} lines recorded.`);
