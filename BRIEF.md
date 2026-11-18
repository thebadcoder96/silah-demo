# Silah demo: build brief

Read this whole file before doing anything. Then propose a plan and wait for a yes before writing code.

## What this is

MM Intelligence (MMI) is meeting Silah Gulf, a Bahrain contact-centre outsourcer (silah.bh), with its CEO, General Manager and Business Development director in the room. We show a short deck, then a live demo site. The goal of the meeting is a proof of concept on Silah's own calls.

The demo site must work two ways: presented live by us, and tried by Silah's people on their own from a link.

The message of every demo: AI in front of, beside and behind the agent. Never instead of the agent. Silah's product is its people, and its government desk is 100% Bahraini.

Background, if you need it: `research/Silah AI demo opportunities.md` (full report) and the other notes in `research/`. The last section of the report lists claims that must not be stated as fact.

## What to build

Copy the structure of the Montgomery demo at `C:\Users\MishahalPalakuniyil\Documents\MMI\Github\mgm-demo`. Read its `README.md`, `index.html`, `lib/voice.js`, `lib/store.js`, `scripts/setup-agents.mjs`, `agents/`, `staff/`, `city/` and `.vercelignore` first. Same stack: static files plus a few Vercel functions, no build step, a private Vercel Blob store for the queue.

### Hub page (`index.html`)

Same layout as the Montgomery hub: dark page, MMI logo, a one-line headline, one grey sentence, three equal tiles each with a line icon, title, one sentence and a "Launch demo" button, and a bottom strip linking to the quality desk. Header line: "Demo for Silah Gulf · Not an official Silah site". `noindex, nofollow`.

### Demo 1: Agent copilot (the centrepiece)

An agent desktop in the browser. The visitor presses "Take a call". An AI customer speaking Bahraini Arabic (an ElevenLabs agent playing a caller with a scenario) rings them. The visitor answers as the agent, by voice. While they talk, the screen shows:

- the live transcript, both speakers labelled, Arabic right-to-left, with an English gloss toggle
- the reason for the call, detected as it becomes clear
- the matching knowledge card and a suggested reply
- a compliance checklist that ticks itself (greeting, identity check, recap, closing)
- CRM fields filled in as proposals, each with Approve and Edit. Nothing saves without the agent's approval.
- at the end: summary, disposition and ticket already written, sent to the quality desk

Names, CPR numbers and IBANs are shown for the agent to confirm, never trusted silently.

Offer two or three caller scenarios for a fictional client (for example a telecom bill dispute, a bank card block, a government appointment). English callers too.

How: the ElevenLabs session already returns both sides' transcripts as events, so the first version needs no separate speech-to-text. After each customer turn, a function sends the transcript so far plus the knowledge base to an LLM and gets back structured JSON (intent, suggested reply, card id, CRM proposals, checklist state). Keep the transcript source behind one small interface so Saheeda can replace it for the human's side (see below).

Later milestone, only after the above works: a real person as the caller over a Twilio call. That needs both audio legs streamed to a small always-on server, which Vercel functions cannot do. Do not start here.

### Demo 2: The talking Silah site

A real clone of silah.bh with a corner voice widget, like the Montgomery city site. The agent speaks Arabic and English, answers questions about Silah's services from the site's own pages, navigates and highlights, fills the contact form, and can hand over to a person. A handover lands in the queue with the conversation summary, so the story connects to Demo 1.

### Demo 3: Campaign desk

A page with a campaign (for example appointment reminders or a satisfaction survey for a fictional client), a lead list and a live results board. Two modes on one UI:

- **Call me**: the visitor types their own mobile number and the AI calls them. One call, `POST /v1/convai/twilio/outbound-call` with `agent_id`, `agent_phone_number_id`, `to_number` and dynamic variables. Twilio can dial Bahrain numbers; we do not have a Bahrain number to call from yet.
- **Simulated campaign**: a list of made-up leads whose calls play out on the board with timers, using transcripts generated ahead of time. Label it "Simulated" on screen. Use the same outcome names the real API returns (answered, voicemail, busy, no_answer, failed) so real and simulated rows look the same.

The agent says it is an AI assistant at the start of an outbound call, offers a person on request, and honours "do not call me again".

For a real multi-lead run later, ElevenLabs has Campaign Manager: `POST /v1/convai/outbound-campaigns/campaigns/submit` (`variant: "simple"` suits a demo), then `/progress`, `/leads` and `/calls` to poll. There is no ElevenLabs sample app to copy; build our own board. The older Batch Calling API is being retired.

### Quality desk (`quality/`), shared by all three

The Montgomery staff queue, repurposed. One queue, every call from every demo, labelled by source (Copilot, Website, Campaign). Each row opens to the transcript, summary, a scorecard result with the evidence line for each criterion, and flags (missed identity check, customer upset, promised callback). The pitch line: one quality standard across AI and human agents, on every call.

Score with an LLM against a short scorecard defined in one file. Use the post-call data ElevenLabs returns (transcript, summary, evaluation results) where it exists.

## Saheeda

Saheeda is MMI's own speech model for Bahraini Arabic, built by Mazin (a fine-tune of Whisper Turbo; about 15 words wrong per 100 on his Bahraini test set). It is a batch model and has not been tested on phone audio yet. We do not have an endpoint for it.

Build so it can be plugged in: one transcript-source interface, ElevenLabs first, Saheeda when Mazin provides an endpoint. Ask the user for the endpoint details when you reach that point. Do not block on it.

## ElevenLabs facts to rely on

- The platform is now called ElevenAgents; docs live under `elevenlabs.io/docs/eleven-agents/`. Check the docs before using any endpoint; this changed recently.
- Client tools (page navigation, form filling) only work in browser sessions, not on phone calls.
- No official Gulf-dialect claim. Dialect quality comes from the voice chosen, a prompt that forces Bahraini wording with a hand-written greeting, and numbers written out in words.
- Gemini 2.5 Flash is removed on 30 Nov 2026 and Turbo v2.5 speech is deprecated. Do not pick either.
- Post-call webhooks carry transcript, summary and evaluation results. There is no streaming progress feed for campaigns; poll.

## Rules learned from the Montgomery build

Agents and voice
- Create every agent from one setup script, in one ElevenLabs account, with the voice set explicitly and expressive mode off. Calm voices, not salesy.
- Build a voice picker page early so the user can listen and choose. Include Gulf-accented voices.
- Agents never say "this is a demonstration". The page banner carries that.
- Never say something was sent or filed without a reference number from the queue.
- Update the screen first, then ask the caller to confirm.
- One site-wide search tool for the site agent. It never asks permission to look at another page.
- Ship prompt, tool and code changes together, so the live site is never half-updated.
- Mute (icon, yellow when muted) and End call on every voice surface from day one. Clicking the call button must not restart a call, and the transcript resets on a new call.

Pages
- The Silah site must be a real clone of the real pages, not a look-alike. If the site blocks downloads, capture pages through the user's own browser, as `scripts/unpack-mirror.mjs` did for Montgomery.
- Links stay inside the clone; anything else shows a "not part of this demo" note. Remove the site's own chat widget and pop-ups.
- A corner voice widget, not a permanent bottom bar.
- Little text. One-line headlines. No "DEMO_01 //" style labels.
- Test every client tool through the page itself before telling the user it works.

Deployment
- Private GitHub repo, then Vercel import through the user's logged-in browser. The Vercel CLI login and connector did not work last time.
- The commit email must match a GitHub account or the deploy is blocked.
- A local JSON queue does not work on Vercel; use a private Blob store from the start.
- Keep `.env`, agent prompts, scripts and prep files off the site with `.vercelignore`. The API key lives only in `.env`.
- Clear test entries from the queue before the meeting.

Working with the user
- Discuss and propose before changing anything.
- One pull request per change, with the link. The user merges and says "Merged". Pull before starting; his brother also commits.
- You cannot use a microphone. Say so up front, and give exact test steps and what to check for each voice change. He reports bugs by pasting call transcripts.
- Use his logged-in browser for dashboards rather than handing him manual steps.

## Content rules

- Use fictional client brands in every scenario. Do not name a real bank, telco or ministry as Silah's client.
- Synthetic data only. No real CPR numbers, IBANs or phone numbers other than the one a visitor types for their own call.
- Do not claim Silah has no AI, and do not quote Silah's financials on any page.

## Out of scope for now

Passcodes, rate limits and keeping Saheeda hosted around the clock. The user has said to leave these until the demos are right.

## Suggested order

1. Repo, hub page, shared voice helper, queue and quality desk shell.
2. Agent copilot, self-serve version, English and Arabic.
3. Campaign desk, simulated mode, then the "call me" call.
4. Silah site clone and its agent, with handover into the queue.
5. Scoring on the quality desk across all three.
6. Saheeda plug-in and the real-caller copilot, if time allows.

## Open questions to ask the user

- Which LLM to use for the copilot and scoring.
- Which Twilio number the outbound call should come from.
- Saheeda endpoint details from Mazin.
- The fictional client names and the two or three copilot scenarios he wants.
