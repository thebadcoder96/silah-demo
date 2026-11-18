# Silah AI demos

Working demos for Silah Gulf by MM Intelligence: AI in front of, beside and behind the contact-centre agent. Not an official Silah site. Every client, customer, account and call in it is made up.

`BRIEF.md` has the original build brief and the rules learned from the Montgomery demo. Live site: https://silah-demo.vercel.app

## The demos

| Tile | Path | What it does |
|---|---|---|
| Campaign desk | `campaign/` | An AI agent works an outbound reminder list. The run is simulated from transcripts written ahead of time; nobody is dialled. One call is handed over to a person. |
| Agent copilot | `copilot/` | The visitor is the agent. An AI caller plays the customer by voice. The copilot shows the transcript, the reason for the call, a suggested reply, the knowledge card and a checklist, drives the client's system, and fills the case form for approval. |
| Quality desk | `quality/` | Every call from the other two, scored against one standard, with the line each result is based on. |

They connect: a campaign call that asks for a person opens in the copilot with the AI's summary, and every finished call lands on the quality desk.

## How the copilot works

Two ElevenLabs sessions run during a call:

- **The call**: a voice session with an AI caller (one agent per scenario and language). It is also the transcript source; every finished line from either side arrives as an event.
- **The brain**: a text-only session with the copilot agent. Each line of the call is sent to it, and it answers by calling tools that run in the page (`update_screen`, `finish_call`). It needs no separate LLM key.

The quality desk's scorer is a third text-only agent with one tool, `score_call`.

To use another speech-to-text for the agent's side, replace what feeds `addLine()` in `copilot/copilot.js`.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5174.

- Add `?text` to the copilot address to type instead of speaking: http://localhost:5174/copilot/?text. No microphone is needed, and the AI customer answers in text.
- `npm run seed` puts three sample calls on the quality desk. Clear them with the "Clear demo queue" button.

## Agents

All agents live in one ElevenLabs account and are created by one script. Run it again after editing `agents/*.md`, `data/scenarios.js` or `lib/scorecard.js`; existing agents are updated in place.

```bash
npm run agents
```

It needs `ELEVENLABS_API_KEY` in `.env`. Voices are set at the top of `scripts/setup-agents.mjs`; expressive mode is off on every agent. To choose voices, run `npm run voices` and open http://localhost:5174/voices.html.

## Deploy

Static files plus the functions in `api/`, so Vercel needs no build step. Pushing to `main` deploys. The queue uses a private Vercel Blob store connected to the project. Keys live only in `.env` locally and in Vercel's environment settings; no page or function needs the ElevenLabs key yet.

## Layout

| Path | What |
|---|---|
| `index.html` | Hub page with the three tiles |
| `campaign/` | The campaign desk |
| `copilot/` | The agent copilot: page, styles and `copilot.js` |
| `quality/` | The quality desk, which also scores unscored calls |
| `data/scenarios.js` | The copilot's three calls: client systems, case forms, knowledge cards and the callers' briefs |
| `data/campaign.js` | The campaign, its leads and their pre-written calls |
| `agents/` | Prompts for the callers, the copilot and the scorer |
| `api/queue.js` | The call queue: list, save, score, clear |
| `lib/store.js` | Where calls and scores are kept: a local JSON file, or Vercel Blob when deployed |
| `lib/scorecard.js` | The one quality standard: criteria and flags |
| `lib/voice.js` | Shared ElevenLabs session helper: voice or text, with mute and end call |
| `config.js` | Agent ids (public by design; never a key) |
| `scripts/` | Dev server, agent setup, voice picker, sample calls |

## A call record

Every demo saves the same shape to `POST /api/queue`, and gets back a reference number such as `SIL-1004`:

`source` (Copilot or Campaign), `simulated`, `handledBy` (AI or Human), `client`, `scenario`, `customer`, `language` (ar or en), `outcome` (answered, voicemail, busy, no_answer, failed), `disposition`, `summary`, `durationSecs`, `flags`, `transcript` (a list of `{ who: agent | customer, text, en }`), `conversationId`, `handoverFrom`.

A score is saved beside the call with `POST /api/queue?score=<reference>`, so a call can be scored after it ends.

## Call audio and voice testing

- **Campaign audio.** The campaign desk's calls are simulated, so their audio is recorded ahead of time: `node scripts/make-campaign-audio.mjs` reads each transcript line with an ElevenLabs voice into `campaign/audio/<lead>/<line>.mp3`. These files are committed. Run it again after changing `data/campaign.js`. The campaign desk and the quality desk play them with `lib/player.js`. Sound is off until someone presses Sound or Listen.
- **Copilot calls have no recording.** Only the transcript is kept.
- **Testing a voice call without a microphone.** `npm run test-audio` writes the agent's side of a call in Bahraini Arabic to `test-audio/` (local only). Open the copilot with `?voicetest`, take a call, and run `voiceTest.play("/test-audio/bank-ar/1.mp3")` in the console for each line. Synthetic speech is cleaner than a person's, so this checks the path, not real-world accuracy.
- **Typing mode.** `?text` on the copilot swaps the microphone for a text box.

## Not built yet

- A real outbound call from the campaign desk ("Call my phone"), which needs a Twilio number.
- A real person as the caller in the copilot.
