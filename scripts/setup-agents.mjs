// Creates or updates every ElevenLabs agent the demos use, in one account, and
// writes their ids into config.js. Run it again after editing agents/*.md or
// data/scenarios.js: agents that already exist are updated in place.
//
//   node scripts/setup-agents.mjs                 everything
//   node scripts/setup-agents.mjs --only copilot  just the copilot
//   node scripts/setup-agents.mjs --only callers  just the AI callers
//   node scripts/setup-agents.mjs --only scorer   just the quality desk's scorer
//   node scripts/setup-agents.mjs --only triage   just the triage line
//   node scripts/setup-agents.mjs --only phone    the agents that work on real phone calls, and the phone number
//
// Needs ELEVENLABS_API_KEY in .env. Voices are set explicitly and expressive
// mode is off on every agent.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SCENARIO_LIST, callerKey } from "../data/scenarios.js";
import { CRITERIA, FLAGS, criteriaFor } from "../lib/scorecard.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const key = (await readFile(`${root}.env`, "utf8").catch(() => "")).match(/^\s*ELEVENLABS_API_KEY\s*=\s*"?([^"\r\n]+)/m)?.[1].trim() || process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("No key found. Create a file named .env in the project folder containing:\n  ELEVENLABS_API_KEY=your key from the ElevenLabs dashboard");
  process.exit(1);
}
const args = process.argv.slice(2);
// The phone that real transfers ring. Kept in .env so it never reaches the repository.
const transferNumber = (await readFile(`${root}.env`, "utf8").catch(() => "")).match(/^\s*TRANSFER_NUMBER\s*=\s*"?(\+\d{8,15})/m)?.[1] || "";
const AFTER_TRANSFER = {
  shown: "After the tool returns, say one short goodbye sentence and end the call.",
  dialled: "After the tool returns, call `transfer_to_number` at once, without speaking first: `client_message` is three or four words asking the caller to hold, in the language of the call (you have already told them where they are going), and `agent_message` is the same English summary, for the person who picks up. Do not say goodbye and do not end the call yourself; the transfer connects them.",
};
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "";

const LLM = "claude-haiku-5-5";
const TTS_MODEL = "eleven_v4_turbo";

// Voices, by language and gender. The Arabic ones are Gulf-accented voices from
// the ElevenLabs library, added to the account the first time this runs.
// Change them here after listening on voices.html.
const VOICES = {
  ar: { male: "Dh7ijKbaKhas3blqwrt3" /* Salim too: on the copilot the agent is a person, so there is no clash */, female: "oOucsh1OZElozgDVjcfe" /* Rafoush */, female2: "albaa6OioIhKtKdCEkQw" /* Laloosh */ },
  en: { male: "cjVigY5qzO86Huf0OWal" /* Eric */, female: "cuTixVvCOWFxeH3oGE9m" /* Clara */, female2: "EXAVITQu4vr4xnSDxMaL" /* Sarah */ },
};
// The AI agents that speak for the centre: Salim, a Bahraini voice made on this
// account, in both languages, so Arabic words inside English are said the
// Arabic way. (Before: Nasser AlJubaily cFUFIbKkO2iZFwS8cRnY in Arabic, and
// Paul J3Ei0Lj6fAobhIqY5ySH, the Montgomery 311 voice, in English.)
const SALIM = "Dh7ijKbaKhas3blqwrt3";
const AGENT_VOICE = { ar: SALIM, en: SALIM };
// Two scenarios have female callers; give the second one a different voice.
const voiceFor = (scenario, language) => VOICES[language][scenario.id === "government" ? "female2" : scenario.caller.gender];

async function api(method, path, body) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method,
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45000), // fail, rather than hang, when the API stalls
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 1500)}`);
  return text ? JSON.parse(text) : {};
}

// ---------- config.js ----------

const CONFIG_HEAD = `// Demo settings. Agent ids are public by design (the same kind of id the
// ElevenLabs embed widget exposes); never put an API key in this file.
// scripts/setup-agents.mjs writes this file; the part after "=" is plain JSON.
window.SILAH_CONFIG = `;
const config = JSON.parse((await readFile(`${root}config.js`, "utf8")).match(/window\.SILAH_CONFIG\s*=\s*(\{[\s\S]*\});?\s*$/)?.[1] || "{}");
config.callerAgentIds ||= {};
// The same ids again as a module, for the server functions (api/).
const saveConfig = async () => {
  await writeFile(`${root}config.js`, `${CONFIG_HEAD}${JSON.stringify(config, null, 2)};\n`);
  await writeFile(`${root}lib/agents.js`, `// Written by scripts/setup-agents.mjs: the same ids as config.js, for the server functions.\nexport default ${JSON.stringify(config, null, 2)};\n`);
};

// ---------- prompts ----------

const section = (md, title) => md.split(new RegExp(`^## ${title}\\s*$`, "m"))[1]?.split(/^## /m)[0].trim();
async function doc(file) {
  const md = await readFile(`${root}agents/${file}`, "utf8");
  return (title) => {
    const found = section(md, title);
    if (!found) throw new Error(`agents/${file} needs a "## ${title}" section.`);
    return found;
  };
}

// How Bahrain sounds, in Arabic and in English: one phrase bank (agents/dialect.md)
// added to the language rules of every agent that speaks.
const dialect = await doc("dialect.md");
const BAHRAINI = { ar: dialect("Bahraini Arabic"), en: dialect("Bahraini English") };
const WHEN = { ar: "WHEN THE CALL IS IN ARABIC", en: "WHEN THE CALL IS IN ENGLISH" };
const ONE_LANGUAGE = "One language per reply: the one the other person last spoke. An Arabic reply is Arabic from the first word to the last, with no English sentence in it. An English reply is English, with only the few Arabic expressions described below.";
const spoken = (rules, ...languages) => (languages.length > 1 ? [rules, ONE_LANGUAGE, ...languages.map((l) => `${WHEN[l]}:\n${BAHRAINI[l]}`)] : [rules, BAHRAINI[languages[0]]]).join("\n\n");

// ---------- voices ----------

async function ensureVoice(id) {
  try {
    await api("GET", `/v1/voices/${id}`);
    return;
  } catch {
    // not on the account yet: add it from the library
  }
  for (const accent of ["gulf", "ar-gulf", "kuwaiti", "saudi"]) {
    const page = await api("GET", `/v1/shared-voices?language=ar&accent=${accent}&sort=usage_character_count_1y&page_size=100`);
    const v = page.voices?.find((x) => x.voice_id === id);
    if (v) {
      await api("POST", `/v1/voices/add/${v.public_owner_id}/${id}`, { new_name: v.name.trim() });
      return console.log(`  voice added to the account: ${v.name.trim()}`);
    }
  }
  throw new Error(`Voice ${id} is not on the account and was not found in the library.`);
}

// ---------- tools ----------

const str = (description) => ({ type: "string", description });
const list = (description, properties, required) => ({ type: "array", description, items: { type: "object", description: "One entry.", properties, required } });

// What is judged about the customer on every call, beside the scorecard.
const INSIGHT = {
  fcr: str("First-contact resolution: yes, no or unknown."),
  csat: { type: "number", description: "Predicted CSAT: the score from 1 to 5 this customer would most likely give. 0 when there is no customer to judge." },
  csat_reason: str("One short English sentence: what in the call the predicted CSAT is based on."),
  sentiment: str("The customer's sentiment at the end of the call: positive, neutral or negative."),
};

const COPILOT_TOOLS = {
  update_screen: {
    description: "Update the agent's screen after new lines of the call. Call it exactly once per message, with only the parts that changed.",
    parameters: {
      type: "object",
      required: [],
      properties: {
        translations: list("English meaning of each new line, for calls that are not in English.", { line: str("The line id, e.g. L4."), en: str("The line in English.") }, ["line", "en"]),
        call_reason: str("Why the customer is calling, in a short phrase."),
        customer_search: str("The name, account number or CPR digits exactly as the customer gave them. The page looks the customer up."),
        show_tab: str("The id of the screen tab to open."),
        highlight_row: str("The id of the one row on that tab to mark."),
        knowledge_card: str("The id of the knowledge card that covers the problem."),
        current_step: { type: "number", description: "The number of the card's step the agent should do next. 0 when every step is done." },
        steps_done: { type: "array", description: "The numbers of the card's steps already done.", items: { type: "number", description: "A step number." } },
        say_next: str("One or two short sentences the agent could say next, in the language of the call."),
        say_next_en: str("The same in English."),
        nudge: str("A short warning when the agent is about to break a rule. Empty otherwise."),
        checklist: list("Steps the AGENT has now done.", { item: str("One of: greeting, identity, recap, closing."), evidence: str("The agent's words that show it.") }, ["item", "evidence"]),
        form_fields: list("Proposed values for the case form.", { field: str("A field id from the case form."), value: str("The proposed value, in English."), heard: str("The words from the call this is based on.") }, ["field", "value", "heard"]),
      },
    },
  },
  finish_call: {
    description: "Write the wrap-up and the scorecard when the call has ended. Call it once, after CALL ENDED.",
    parameters: {
      type: "object",
      required: ["summary", "disposition", "ticket_title", "scorecard", "fcr", "csat", "csat_reason", "sentiment"],
      properties: {
        summary: str("Two or three plain sentences in English."),
        disposition: str("The outcome in a few words."),
        ticket_title: str("A short title for the case."),
        flags: { type: "array", description: "Any of: missed_identity_check, customer_upset, promised_callback, asked_for_person, do_not_call.", items: str("One flag.") },
        scorecard: list("One entry for each of: greeting, identity, resolution, recap, courtesy, closing.", { id: str("The criterion id."), result: str("pass, fail or unknown."), evidence: str("The agent's line that shows it, or what was missing.") }, ["id", "result", "evidence"]),
        ...INSIGHT,
      },
    },
  },
};

const SCORER_TOOLS = {
  score_call: {
    description: "Give the scorecard for the call. Call it exactly once.",
    parameters: {
      type: "object",
      required: ["scorecard", "fcr", "csat", "csat_reason", "sentiment"],
      properties: {
        scorecard: COPILOT_TOOLS.finish_call.parameters.properties.scorecard,
        flags: COPILOT_TOOLS.finish_call.parameters.properties.flags,
        ...INSIGHT,
      },
    },
  },
};
const TRIAGE_TOOLS = {
  show_triage: {
    description: "Show what you have understood so far. Call it as soon as you know what the caller needs, and again if that changes.",
    parameters: {
      type: "object",
      required: ["need", "desk", "urgency"],
      properties: {
        need: str("What the caller needs, in a short English phrase."),
        desk: str("Where it belongs: cpr, complaints, or self when you can answer it yourself."),
        urgency: str("low, normal or high."),
        caller_name: str("The caller's name, once you have it."),
      },
    },
  },
  transfer_call: {
    description: "Put the caller through to a desk. Call it once, after telling the caller.",
    parameters: {
      type: "object",
      required: ["desk", "summary", "caller_name"],
      properties: {
        desk: str("cpr or complaints."),
        summary: str("For the person picking up, in English, two sentences at most: who is calling, what they need, what you already told them."),
        caller_name: str("The caller's name, or an empty string if they did not give one."),
      },
    },
  },
};
// The one standard, written out for a prompt.
const criteriaText = (list) => list.map((c) => `- \`${c.id}\` (${c.label}${c.appliesTo ? `, ${c.appliesTo} agents only` : ""}): ${c.what}`).join("\n");
const flagsText = Object.entries(FLAGS).map(([id, label]) => `- \`${id}\`: ${label.toLowerCase()}`).join("\n");

async function syncTools(defs, existingIds = []) {
  const names = await Promise.all(existingIds.map(async (id) => (await api("GET", `/v1/convai/tools/${id}`)).tool_config.name));
  const ids = [];
  for (const [name, def] of Object.entries(defs)) {
    const tool_config = { type: "client", name, description: def.description, parameters: def.parameters, expects_response: true, response_timeout_secs: 20 };
    const at = names.indexOf(name);
    if (at >= 0) {
      await api("PATCH", `/v1/convai/tools/${existingIds[at]}`, { tool_config });
      ids.push(existingIds[at]);
    } else {
      const made = await api("POST", "/v1/convai/tools", { tool_config });
      console.log(`  tool ${name} -> ${made.id}`);
      ids.push(made.id);
    }
  }
  return ids;
}

// ---------- agents ----------

/** Create the agent, or update it in place if config.js already has its id. Returns the id. */
async function upsertAgent(id, name, body) {
  if (id) {
    try {
      await api("PATCH", `/v1/convai/agents/${id}`, { name, ...body });
      console.log(`  updated  ${name}`);
      return id;
    } catch (err) {
      if (!/-> 404/.test(err.message)) throw err;
    }
  }
  const made = await api("POST", "/v1/convai/agents/create", { name, ...body });
  console.log(`  created  ${name} -> ${made.agent_id}`);
  return made.agent_id;
}

const EVENTS = ["conversation_initiation_metadata", "audio", "interruption", "ping", "user_transcript", "agent_response", "agent_response_correction", "client_tool_call"];
const TEXT_MODE_ALLOWED = { overrides: { conversation_config_override: { conversation: { text_only: true } } } };

async function setupCopilot() {
  console.log("Copilot");
  const read = await doc("copilot.md");
  let existing = [];
  if (config.copilotAgentId) existing = (await api("GET", `/v1/convai/agents/${config.copilotAgentId}`).catch(() => null))?.conversation_config.agent.prompt.tool_ids || [];
  const tool_ids = await syncTools(COPILOT_TOOLS, existing);
  config.copilotAgentId = await upsertAgent(config.copilotAgentId, "Silah Demo - Copilot", {
    conversation_config: {
      agent: {
        first_message: "",
        language: "en",
        dynamic_variables: { dynamic_variable_placeholders: { client: "the client", language: "English", pack: "{}" } },
        prompt: { prompt: read("System prompt").replace("[[criteria]]", criteriaText(criteriaFor("Human"))), llm: LLM, temperature: 0, tool_ids },
      },
      conversation: { text_only: true, max_duration_seconds: 1800, client_events: EVENTS },
    },
    platform_settings: TEXT_MODE_ALLOWED,
  });
  await saveConfig();
}

async function setupScorer() {
  console.log("Scorer");
  const read = await doc("scorer.md");
  let existing = [];
  if (config.scorerAgentId) existing = (await api("GET", `/v1/convai/agents/${config.scorerAgentId}`).catch(() => null))?.conversation_config.agent.prompt.tool_ids || [];
  const tool_ids = await syncTools(SCORER_TOOLS, existing);
  config.scorerAgentId = await upsertAgent(config.scorerAgentId, "Silah Demo - Scorer", {
    conversation_config: {
      agent: {
        first_message: "",
        language: "en",
        prompt: { prompt: read("System prompt").replace("[[criteria]]", criteriaText(CRITERIA)).replace("[[flags]]", flagsText), llm: LLM, temperature: 0, tool_ids },
      },
      conversation: { text_only: true, max_duration_seconds: 300, client_events: EVENTS },
    },
    platform_settings: TEXT_MODE_ALLOWED,
  });
  await saveConfig();
}

async function setupCallers() {
  console.log("AI callers");
  const read = await doc("caller.md");
  const template = read("System prompt");
  for (const s of SCENARIO_LIST) {
    for (const language of ["ar", "en"]) {
      const voice_id = voiceFor(s, language);
      await ensureVoice(voice_id);
      const fill = { name: s.customer.name, name_ar: s.customer.nameAr, client: s.client, brief: s.caller.brief, cpr: s.customer.cprLast4.split("").join(" "), callback: s.caller.callback, mood: s.caller.mood, happy: s.caller.happyWhen, language_rules: spoken(read(`Language rules: ${language === "ar" ? "Arabic" : "English"}`), language) };
      // Two passes, so the placeholders inside the language rules are filled too.
      const once = (text) => text.replace(/\[\[(\w+)\]\]/g, (_, k) => fill[k] ?? "");
      const prompt = once(once(template));
      const k = callerKey(s.id, language);
      config.callerAgentIds[k] = await upsertAgent(config.callerAgentIds[k], `Silah Demo - Caller - ${s.client} (${language})`, {
        conversation_config: {
          agent: {
            first_message: language === "ar" ? "ألو؟" : "Hello?",
            language,
            dynamic_variables: { dynamic_variable_placeholders: { context: "You are calling the contact centre yourself." } },
            prompt: { prompt, llm: LLM, temperature: 0.5, built_in_tools: { end_call: { type: "system", name: "end_call", description: "", params: { system_tool_type: "end_call" } } } },
          },
          tts: { voice_id, model_id: TTS_MODEL, expressive_mode: false },
          asr: { keywords: [s.client, ...s.client.split(" ").slice(0, 1)] },
          conversation: { max_duration_seconds: 600, client_events: EVENTS },
        },
        platform_settings: TEXT_MODE_ALLOWED,
      });
      await saveConfig();
    }
  }
}

async function setupTriage() {
  console.log("Triage line");
  const read = await doc("triage.md");
  config.triageAgentIds ||= {};
  // Both languages share one set of tools.
  const first = config.triageAgentIds.ar || config.triageAgentIds.en;
  const existing = first ? (await api("GET", `/v1/convai/agents/${first}`).catch(() => null))?.conversation_config.agent.prompt.tool_ids || [] : [];
  const tool_ids = await syncTools(TRIAGE_TOOLS, existing);
  for (const language of ["ar", "en"]) {
    const name = language === "ar" ? "Arabic" : "English";
    const voice_id = AGENT_VOICE[language];
    await ensureVoice(voice_id);
    const id = config.triageAgentIds[language];
    config.triageAgentIds[language] = await upsertAgent(id, `Silah Demo - Triage line (${language})`, {
      conversation_config: {
        agent: {
          first_message: read(`First message: ${name}`),
          language,
          prompt: { prompt: read("System prompt").replace("[[language_rules]]", spoken(read(`Language rules: ${name}`), language, language === "ar" ? "en" : "ar")).replace("[[after_transfer]]", AFTER_TRANSFER.shown), llm: LLM, temperature: 0.2, tool_ids, built_in_tools: { end_call: { type: "system", name: "end_call", description: "", params: { system_tool_type: "end_call" } } } },
        },
        tts: { voice_id, model_id: TTS_MODEL, expressive_mode: false },
        asr: { keywords: ["Khidmati", "CPR"] },
        conversation: { max_duration_seconds: 600, client_events: EVENTS },
      },
      platform_settings: TEXT_MODE_ALLOWED,
    });
    await saveConfig();
  }
}

// ---------- real phone calls ----------
// A phone call has no browser, so the triage agent's two tools become webhooks
// that call this site (api/phone.js). The campaign agent needs no tools.

const SITE = (args.includes("--site") ? args[args.indexOf("--site") + 1] : "https://silah-demo.vercel.app").replace(/\/$/, "");
const END_CALL = { end_call: { type: "system", name: "end_call", description: "", params: { system_tool_type: "end_call" } } };

async function setupPhone() {
  console.log("Phone agents");
  for (const v of Object.values(AGENT_VOICE)) await ensureVoice(v);

  // the triage agent that answers the number: starts in Arabic, follows the caller into English
  const triage = await doc("triage.md");
  config.triagePhoneToolIds ||= {};
  for (const [name, def] of Object.entries(TRIAGE_TOOLS)) {
    const tool_config = { type: "webhook", name, description: def.description, response_timeout_secs: 20, api_schema: { url: `${SITE}/api/phone?tool=${name}`, method: "POST", request_body_schema: def.parameters } };
    const id = config.triagePhoneToolIds[name];
    if (id) await api("PATCH", `/v1/convai/tools/${id}`, { tool_config });
    else config.triagePhoneToolIds[name] = (await api("POST", "/v1/convai/tools", { tool_config })).id;
  }
  // Every desk rings the one phone in .env, as a warm transfer: whoever picks up hears the summary first.
  const TRANSFER = transferNumber ? {
    transfer_to_number: {
      type: "system",
      name: "transfer_to_number",
      description: "",
      params: { system_tool_type: "transfer_to_number", transfers: [{ transfer_destination: { type: "phone", phone_number: transferNumber }, condition: "After transfer_call has returned, for either desk.", transfer_type: "conference" }] },
    },
  } : {};
  console.log(transferNumber ? "  transfers ring the number in .env" : "  no TRANSFER_NUMBER in .env: the agent says it is transferring, then ends the call");
  const bothLanguages = spoken("Your greeting was in Bahraini Arabic. Answer in the language the caller uses: Bahraini Arabic, the everyday spoken dialect and not formal Arabic, or English. Stay in that language unless the caller changes. Say times and numbers in words.", "ar", "en");
  config.triagePhoneAgentId = await upsertAgent(config.triagePhoneAgentId, "Silah Demo - Triage line (phone)", {
    conversation_config: {
      agent: {
        first_message: triage("First message: Arabic"),
        // English is the platform language although the greeting is Arabic: the warm transfer
        // hands Twilio this language, and Twilio refuses "ar" there (error 13512), which
        // dropped every transfer. Arabic is listed as the agent's second language.
        language: "en",
        prompt: { prompt: triage("System prompt").replace("[[language_rules]]", bothLanguages).replace("[[after_transfer]]", transferNumber ? AFTER_TRANSFER.dialled : AFTER_TRANSFER.shown), llm: LLM, temperature: 0.2, tool_ids: Object.values(config.triagePhoneToolIds), built_in_tools: { ...END_CALL, ...TRANSFER } },
      },
      tts: { voice_id: AGENT_VOICE.ar, model_id: TTS_MODEL, expressive_mode: false },
      asr: { keywords: ["Khidmati", "CPR"] },
      conversation: { max_duration_seconds: 600 },
      language_presets: { ar: { overrides: { agent: { first_message: triage("First message: Arabic") } } } },
    },
  });
  await saveConfig();

  // the campaign agent that rings a phone, one per language
  const campaign = await doc("campaign.md");
  config.campaignAgentIds ||= {};
  for (const language of ["ar", "en"]) {
    const name = language === "ar" ? "Arabic" : "English";
    config.campaignAgentIds[language] = await upsertAgent(config.campaignAgentIds[language], `Silah Demo - Campaign call (${language})`, {
      conversation_config: {
        agent: {
          first_message: campaign(`First message: ${name}`),
          language,
          dynamic_variables: { dynamic_variable_placeholders: { name: "there", appointment: "Sunday at ten in the morning", centre: "the Isa Town centre" } },
          prompt: { prompt: campaign("System prompt").replace("[[language_rules]]", spoken(campaign(`Language rules: ${name}`), language, language === "ar" ? "en" : "ar")), llm: LLM, temperature: 0.3, built_in_tools: END_CALL },
        },
        tts: { voice_id: AGENT_VOICE[language], model_id: TTS_MODEL, expressive_mode: false },
        asr: { keywords: ["Khidmati", "CPR"] },
        conversation: { max_duration_seconds: 300 },
      },
    });
    await saveConfig();
  }

  // the phone number: the one on the account whose label mentions Silah
  const numbers = await api("GET", "/v1/convai/phone-numbers");
  const mine = (Array.isArray(numbers) ? numbers : numbers.phone_numbers || []).find((n) => /silah/i.test(n.label || ""));
  if (!mine) {
    console.log('\n  No phone number yet. Import one in ElevenLabs (Phone Numbers -> Import number -> Twilio) with a label that contains "Silah", then run this again.');
  } else {
    await api("PATCH", `/v1/convai/phone-numbers/${mine.phone_number_id}`, { agent_id: config.triagePhoneAgentId });
    config.phone = { id: mine.phone_number_id, number: mine.phone_number };
    console.log(`  ${mine.phone_number} answers with the triage agent, and places the campaign calls`);
  }
  await saveConfig();
}

try {
  if (only === "phone") await setupPhone();
  if (!only || only === "triage") await setupTriage();
  if (!only || only === "copilot") await setupCopilot();
  if (!only || only === "callers") await setupCallers();
  if (!only || only === "scorer") await setupScorer();
  console.log("\nDone. config.js has the agent ids.");
} catch (err) {
  console.error(`\nSetup stopped:\n${err.message}`);
  process.exit(1);
}
