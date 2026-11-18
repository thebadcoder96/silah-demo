// Builds spoken test lines for the copilot, so a call can be tested by voice
// without a person at a microphone: the agent's side of a call, said in
// Bahraini Arabic by an ElevenLabs voice.
//   node scripts/make-test-audio.mjs
// Writes test-audio/<script>/<n>.mp3 and test-audio/<script>/lines.json (kept
// off git and off the site). Play them into a call from the copilot page
// opened with ?voicetest (see copilot/voice-test.js).
//
// Synthetic speech is cleaner than a real person's, so transcription will look
// better here than it will for a real agent. This checks the path, not the accuracy.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const key = (await readFile(`${root}.env`, "utf8")).match(/^\s*ELEVENLABS_API_KEY\s*=\s*"?([^"\r\n]+)/m)?.[1].trim();

// The voice that plays the human agent. Different from the caller's voice in the same scenario.
const AGENT_VOICE = { ar: "TfevL8tqOhb9PBTrfU9u" /* Sahl */, en: "cjVigY5qzO86Huf0OWal" /* Eric */ };
const MODEL = "eleven_v4_turbo";

const SCRIPTS = {
  "bank-ar": {
    language: "ar",
    lines: [
      "السلام عليكم، بنك مرجان، معاج أحمد. شلون أقدر أساعدج؟",
      "ما عليه، لا تحاتين. ممكن اسمج الكامل وآخر أربع أرقام من الرقم الشخصي؟",
      "مشكورة أختي فاطمة. أشوف إن البطاقة توقفت لأن الرقم السري انكتب غلط ثلاث مرات في صراف السيف أمس الساعة تسع ونص. إنتي اللي حاولتي؟",
      "زين، يعني ما في أي عملية غريبة. الحين برفع طلب فتح البطاقة، وبتشتغل خلال ربع ساعة.",
      "وتقدرين تحطين رقم سري جديد من تطبيق مرجان أو من أي صراف مرجان.",
      "يعني فتحنا البطاقة وبتشتغل خلال ربع ساعة، وتغيرين الرقم السري من التطبيق. تبين شي ثاني؟",
      "حياج الله، مع السلامة.",
    ],
  },
  "telecom-ar": {
    language: "ar",
    lines: [
      "السلام عليكم، تايلوس للاتصالات، معاك أحمد. شلون أقدر أساعدك؟",
      "أكيد، بشوف لك الموضوع. ممكن اسمك الكامل وآخر أربع أرقام من الرقم الشخصي؟",
      "مشكور أخوي يوسف. أشوف في فاتورة نوفمبر رسوم تجوال في السعودية يوم ثلاثة نوفمبر، اثنعش دينار. كنت مسافر؟",
      "فاهم عليك. الحين برفع اعتراض على رسوم التجوال، والمبلغ بيتوقف لين يطلع القرار.",
      "وبتوصلك رسالة نصية بالقرار خلال يومين عمل.",
      "يعني رفعنا اعتراض على الاثنعش دينار، وبيوصلك الرد برسالة خلال يومين عمل. تبي شي ثاني؟",
      "حياك الله، مع السلامة.",
    ],
  },
};

for (const [name, script] of Object.entries(SCRIPTS)) {
  const dir = `${root}test-audio/${name}`;
  await mkdir(dir, { recursive: true });
  for (const [i, text] of script.lines.entries()) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${AGENT_VOICE[script.language]}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`line ${i + 1} of ${name} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
    await writeFile(`${dir}/${i + 1}.mp3`, Buffer.from(await res.arrayBuffer()));
    console.log(`${name}/${i + 1}.mp3  ${text.slice(0, 50)}`);
  }
  await writeFile(`${dir}/lines.json`, JSON.stringify(script.lines, null, 1));
}
