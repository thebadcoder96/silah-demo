# Silah AI demos

Working demos for Silah Gulf by MM Intelligence: AI in front of, beside and behind the contact-centre agent. Not an official Silah site. Every client, customer, account and call in it is made up.

`BRIEF.md` has the full build brief and the rules learned from the Montgomery demo.

## The demos

| Tile | Path | State |
|---|---|---|
| Campaign desk: AI works an outbound call list and hands over to a person | `campaign/` | Not built yet |
| Agent copilot: take a call while AI finds the answer and fills the screen for approval | `copilot/` | Not built yet |
| Quality desk: every call from the other two, scored against one standard | `quality/` | Shell built; scoring comes later |

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5174. To look at the quality desk with sample calls in it:

```bash
npm run seed -- --scored
```

Clear them again with the "Clear demo queue" button on the quality desk.

## Pick voices

```bash
npm run voices
```

This writes `voices.html` (kept off git and off the site). Open http://localhost:5174/voices.html, listen, mark the voices and copy the picks. It needs `ELEVENLABS_API_KEY` in `.env`.

## Deploy

Static files plus the functions in `api/`, so Vercel needs no build step. The queue needs a private Vercel Blob store connected to the project (it sets `BLOB_READ_WRITE_TOKEN`); without one, saving a call fails with a demo queue error. Keys live only in `.env` locally and in Vercel's environment settings.

## Layout

| Path | What |
|---|---|
| `index.html` | Hub page with the three tiles |
| `quality/` | The quality desk |
| `api/queue.js` | The call queue: list, save, clear |
| `lib/store.js` | Where calls and scores are kept: a local JSON file, or Vercel Blob when deployed |
| `lib/scorecard.js` | The one quality standard: criteria and flags |
| `lib/voice.js` | Shared ElevenLabs voice session helper, with mute and end call |
| `lib/orb.js` | The small live-status orb |
| `config.js` | Agent ids (public by design; never a key) |
| `scripts/dev-server.mjs` | Local stand-in for Vercel |
| `scripts/seed-queue.mjs` | Sample calls for the quality desk |
| `scripts/make-voice-page.mjs` | Builds the voice picker |

## A call record

Every demo saves the same shape to `POST /api/queue`, and gets back a reference number such as `SIL-1004`:

`source` (Copilot or Campaign), `simulated`, `handledBy` (AI or Human), `client`, `scenario`, `customer`, `language` (ar or en), `outcome` (answered, voicemail, busy, no_answer, failed), `disposition`, `summary`, `durationSecs`, `flags`, `transcript` (a list of `{ who: agent | customer, text, en }`), `conversationId`, `handoverFrom`.

A score is saved beside the call, not inside it, so a call can be scored after it ends.
