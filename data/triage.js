// The triage line: who answers, and the desks a call can be sent to. A transfer
// is shown on the page, on the phone number too: nobody's phone rings.

export const TRIAGE = {
  client: "Khidmati Service Centre",
  line: "Main line",
  desks: {
    self: { name: "Answered by the AI agent", note: "Opening hours, what to bring, where to go" },
    cpr: { name: "CPR and appointments desk", transfer: true, note: "Appointments, lost cards, fees, one person's file" },
    complaints: { name: "Complaints and follow-up desk", transfer: true, note: "Complaints, late cases, repeat callers" },
  },
};
