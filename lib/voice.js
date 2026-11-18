// Browser helper shared by the demo pages: start and stop an ElevenLabs voice
// session, with mute and end call built in.

// Pinned, so a new SDK release cannot change a live demo.
const SDK = "https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.37.0/+esm";

/** A value from config.js, e.g. configValue("campaignAgentId"). ?<key>=... in the address bar wins. */
export function configValue(key) {
  return new URLSearchParams(location.search).get(key) || window.SILAH_CONFIG?.[key] || "";
}

/** Wrap plain functions so the agent always gets a JSON string back and failures are spoken, not thrown. */
export function asClientTools(tools, onCall = () => {}) {
  return Object.fromEntries(
    Object.entries(tools).map(([name, fn]) => [
      name,
      async (params) => {
        onCall(name, params || {});
        try {
          return JSON.stringify(await fn(params || {}));
        } catch (err) {
          console.error(name, err);
          return JSON.stringify({ error: "That did not work. Apologise and offer to try again." });
        }
      },
    ]),
  );
}

/**
 * createVoice({ clientTools, onStatus(state), onMessage(who, text) })
 *   state is one of: idle, connecting, listening, speaking.
 *   who is "user" (the person at this browser), "agent" (the ElevenLabs agent) or "note".
 *
 * Returns { start(options), end(), active(), id(), mute(on), muted(), send(text), levels() }.
 * start() does nothing while a call is running, so a second click on a call
 * button never restarts the call; only end() hangs up.
 */
export function createVoice({ clientTools, onStatus = () => {}, onMessage = () => {} } = {}) {
  let conversation = null;
  let starting = false;
  let muted = false;

  /**
   * options: { agentId, dynamicVariables, overrides, textOnly }
   * textOnly runs the session as typed text with no microphone and no audio
   * (the agent must allow the text_only override).
   */
  async function start({ agentId, dynamicVariables, overrides, textOnly = false } = {}) {
    if (conversation || starting) return false;
    if (!agentId) {
      onMessage("note", "No voice agent is connected yet");
      return false;
    }
    starting = true;
    muted = false;
    onStatus("connecting");
    try {
      if (!textOnly) await navigator.mediaDevices.getUserMedia({ audio: true });
      const { Conversation } = await import(SDK);
      if (textOnly) overrides = { ...overrides, conversation: { ...overrides?.conversation, textOnly: true } };
      conversation = await Conversation.startSession({
        agentId,
        connectionType: textOnly ? "websocket" : "webrtc",
        clientTools,
        ...(dynamicVariables ? { dynamicVariables } : {}),
        ...(overrides ? { overrides } : {}),
        onConnect: () => onStatus("listening"),
        onDisconnect: () => {
          conversation = null;
          muted = false;
          onStatus("idle");
        },
        onModeChange: ({ mode }) => onStatus(mode === "speaking" ? "speaking" : "listening"),
        onMessage: ({ message, source }) => onMessage(source === "user" ? "user" : "agent", message),
        onError: (err) => {
          console.error(err);
          onMessage("note", "Voice connection problem");
        },
      });
      return true;
    } catch (err) {
      console.error(err);
      conversation = null;
      onStatus("idle");
      onMessage("note", err?.name === "NotAllowedError" ? "Microphone access was blocked" : "Could not start the call");
      return false;
    } finally {
      starting = false;
    }
  }

  return {
    start,
    /** Hang up. Safe to call when no call is running. */
    end() {
      conversation?.endSession();
    },
    active: () => Boolean(conversation),
    /** The ElevenLabs conversation id of the running call, for fetching its record afterwards. */
    id: () => conversation?.getId?.() || "",
    /** Mute or unmute the microphone, so the presenter can talk to the room. Returns the new state. */
    mute(on) {
      if (!conversation) return false;
      muted = Boolean(on);
      conversation.setMicMuted(muted);
      return muted;
    },
    muted: () => muted,
    /** Send typed text to the live agent. Returns false when no call is running. */
    send(text) {
      if (!conversation) return false;
      conversation.sendUserMessage(text);
      return true;
    },
    /** Live audio levels, 0 to 1, for a visualizer. */
    levels() {
      try {
        return { input: conversation?.getInputVolume?.() || 0, output: conversation?.getOutputVolume?.() || 0 };
      } catch {
        return { input: 0, output: 0 };
      }
    },
  };
}
