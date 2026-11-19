// The triage line: who answers, and the desks a call can be sent to. On the
// real phone number every desk rings one phone for the demo; its number is not
// kept in this file (it is TRANSFER_NUMBER in .env, and goes into the transfer
// tool on the ElevenLabs agent).

export const TRIAGE = {
  client: "Khidmati Service Centre",
  line: "Main line",
  desks: {
    self: { name: "Answered by the AI agent", note: "Opening hours, what to bring, where to go" },
    cpr: { name: "CPR and appointments desk", person: "Mishal", note: "Appointments, lost cards, fees, one person's file" },
    complaints: { name: "Complaints and follow-up desk", person: "Mishal", note: "Complaints, late cases, repeat callers" },
  },
};
