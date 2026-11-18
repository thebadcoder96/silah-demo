// Demo settings. Agent ids are public by design (the same kind of id the
// ElevenLabs embed widget exposes); never put an API key in this file.
// scripts/setup-agents.mjs writes this file; the part after "=" is plain JSON.
window.SILAH_CONFIG = {
  "callerAgentIds": {
    "telecom_ar": "agent_0301m7p4yjvhe1c97b8tvhxbaqcx",
    "telecom_en": "agent_5501m7p4ym36fk2vdb91520sbsgp",
    "bank_ar": "agent_3501m7p4ys4je6rsby88srdvq5cb",
    "bank_en": "agent_8501m7p4yte2en8vqh0gmmbj2ah5",
    "government_ar": "agent_1601m7p4yyb4ehgvc0ffqyydw6kt",
    "government_en": "agent_8201m7p4yzecev68fgn27m0bvb48"
  },
  "copilotAgentId": "agent_8201m7p4ycegedt8nbwheejnbtvy",
  "scorerAgentId": "agent_2501m7p5te79f5899y52v73j9g42",
  "triageAgentIds": {
    "ar": "agent_2601m7rbbc6ze8k97sdkjt7gbwff",
    "en": "agent_5801m7rbbds9ej89pz05ngjfwgm3"
  },
  "triagePhoneToolIds": {
    "show_triage": "tool_4501m7rckhzefjhrhv8t0etgg2gn",
    "transfer_call": "tool_6701m7rckj1kepk9md6jjzp36x5w"
  },
  "triagePhoneAgentId": "agent_6601m7rckj9xe0g9wfkmnwj5fat4",
  "campaignAgentIds": {
    "ar": "agent_0501m7rckkppe9v9c15cg7bzw4cm",
    "en": "agent_0101m7rckn8dfdbre6mbwmdr2h38"
  }
};
