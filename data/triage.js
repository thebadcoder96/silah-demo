// The triage line: who answers, and the desks a call can be sent to. The
// people are the two phones a real transfer would ring; their numbers are not
// kept in this file (they belong in the transfer tool on the ElevenLabs agent).

export const TRIAGE = {
  client: "Khidmati Service Centre",
  line: "Main line",
  desks: {
    self: { name: "Answered by the AI agent", note: "Opening hours, what to bring, where to go" },
    cpr: { name: "CPR and appointments desk", person: "Mishal", note: "Appointments, lost cards, fees, one person's file" },
    complaints: { name: "Complaints and follow-up desk", person: "Mazin", note: "Complaints, late cases, repeat callers" },
  },
};
