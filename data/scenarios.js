// The copilot's three calls. Everything here is made up: the clients, the
// customers, the account numbers and the rules. Shared by the copilot page
// (the mock client system and knowledge cards) and scripts/setup-agents.mjs
// (the AI callers' briefs).

export const SCENARIOS = {
  telecom: {
    id: "telecom",
    client: "Tylos Telecom",
    sector: "Telecom",
    title: "Bill dispute",
    blurb: "A customer's bill is higher than usual.",
    accent: "#0f766e",
    customer: { name: "Yousif Hasan", nameAr: "يوسف حسن", cprLast4: "4412", account: "TT-208831", detail: "Postpaid mobile · customer since 2019" },
    tabs: [
      {
        id: "bills", title: "Bills", columns: ["Month", "Amount", "Status", "Due"],
        rows: [
          { id: "bill-nov", cells: ["November 2026", "BHD 31.500", "Unpaid", "5 Dec"] },
          { id: "bill-oct", cells: ["October 2026", "BHD 19.500", "Paid", "5 Nov"] },
          { id: "bill-sep", cells: ["September 2026", "BHD 19.500", "Paid", "5 Oct"] },
        ],
      },
      {
        id: "charges", title: "November charges", columns: ["Charge", "Date", "Amount"],
        rows: [
          { id: "chg-plan", cells: ["Tylos 20 monthly plan", "1 Nov", "BHD 19.500"] },
          { id: "chg-roam", cells: ["Roaming data pass, Saudi Arabia", "3 Nov", "BHD 12.000"] },
        ],
      },
      {
        id: "usage", title: "Roaming log", columns: ["When", "Network", "Data"],
        rows: [{ id: "use-roam", cells: ["3 Nov, 02:14", "Saudi network, picked up near the causeway", "0.4 MB"] }],
      },
    ],
    form: {
      title: "Billing dispute",
      fields: [
        { id: "charge", label: "Charge disputed" },
        { id: "amount", label: "Amount" },
        { id: "reason", label: "Customer's reason" },
        { id: "callback", label: "Callback number" },
        { id: "promised", label: "What we promised" },
      ],
    },
    kb: [
      {
        id: "roaming-dispute", title: "Disputing a roaming charge",
        body: [
          "Confirm the customer's full name and the last four digits of their CPR before discussing the bill.",
          "Open November charges and the roaming log. A phone near the causeway can pick up a Saudi network without leaving Bahrain.",
          "Raise a billing dispute for the roaming charge. The disputed amount is put on hold and is not due until the dispute is decided.",
          "Tell the customer they will get a decision by SMS within two working days.",
          "Repeat back what was agreed, and check nothing else is needed.",
        ],
        caution: "Do not promise a refund. Only the billing team can approve one.",
      },
      {
        id: "bill-due", title: "Paying while a dispute is open",
        body: ["The customer pays the rest of the bill by the due date.", "No late fee is charged on a disputed amount."],
      },
    ],
    caller: {
      gender: "male",
      brief: "Your November mobile bill is thirty-one and a half dinars. It is normally nineteen and a half. You do not know why. If the agent mentions a roaming charge on the third of November for Saudi Arabia, say firmly that you did not leave Bahrain all month; if asked, you did drive along the coast near the causeway one night. You want the extra twelve dinars removed.",
      mood: "Annoyed but polite. You calm down once the agent takes it seriously.",
      happyWhen: "The agent raises a dispute for the roaming charge and tells you when you will hear back.",
      callback: "three nine double-zero, one one eight four (a made-up number you give if asked for a callback number)",
    },
  },

  bank: {
    id: "bank",
    client: "Marjan Bank",
    sector: "Bank",
    title: "Card blocked",
    blurb: "A customer's debit card was declined at a shop.",
    accent: "#1d4ed8",
    customer: { name: "Fatima Al Mansoor", nameAr: "فاطمة المنصور", cprLast4: "7731", account: "MB-551204", detail: "Current account · customer since 2016" },
    tabs: [
      {
        id: "cards", title: "Cards", columns: ["Card", "Status", "Note"],
        rows: [
          { id: "card-debit", cells: ["Debit card ending 5068", "Blocked", "Wrong PIN entered three times, 16 Nov 21:38"] },
          { id: "card-credit", cells: ["Credit card ending 2290", "Active", ""] },
        ],
      },
      {
        id: "activity", title: "Recent activity", columns: ["When", "Where", "Result"],
        rows: [
          { id: "act-atm", cells: ["16 Nov, 21:38", "Cash machine, Seef", "PIN declined three times"] },
          { id: "act-shop", cells: ["16 Nov, 18:05", "Supermarket, Riffa", "BHD 14.250 approved"] },
          { id: "act-fuel", cells: ["15 Nov, 08:40", "Fuel station, Isa Town", "BHD 6.000 approved"] },
        ],
      },
    ],
    form: {
      title: "Card service request",
      fields: [
        { id: "card", label: "Card" },
        { id: "request", label: "Request" },
        { id: "reason", label: "Reason for the block" },
        { id: "checked", label: "Customer confirms the last activity" },
        { id: "promised", label: "What we promised" },
      ],
    },
    kb: [
      {
        id: "pin-block", title: "Card blocked after wrong PIN",
        body: [
          "Confirm the customer's full name and the last four digits of their CPR. Never ask for the full card number or the PIN.",
          "Open Cards and Recent activity. Read the last activity back and ask the customer to confirm it was them.",
          "If the customer recognises the activity, raise a PIN unblock request. The card works again within fifteen minutes.",
          "Tell the customer they can set a new PIN in the Marjan app or at any Marjan cash machine.",
          "Repeat back what was agreed, and check nothing else is needed.",
        ],
        caution: "If the customer does not recognise the activity, do not unblock. Raise a card replacement and a fraud review instead.",
      },
      {
        id: "card-replace", title: "Replacing a card",
        body: ["A replacement card is ready at the customer's branch in three working days.", "There is no fee when the bank blocks the card."],
      },
    ],
    caller: {
      gender: "female",
      brief: "Your debit card was just declined at a pharmacy and you are standing at the till. You are worried someone has used your card. Last night around half past nine you tried to take cash out at a cash machine in Seef and got the PIN wrong a few times because you had mixed it up with your other card; you only remember this if the agent mentions the cash machine or wrong PIN attempts. The supermarket in Riffa and the fuel station were you as well.",
      mood: "Flustered and in a hurry. Relieved once you understand it was the wrong PIN.",
      happyWhen: "The agent tells you the card will be unblocked and how to set a new PIN.",
      callback: "three six double-zero, two two five nine (a made-up number you give if asked for a callback number)",
    },
  },

  government: {
    id: "government",
    client: "Khidmati Service Centre",
    sector: "Government services",
    title: "Move an appointment",
    blurb: "A customer needs a new time for an CPR card renewal.",
    accent: "#9a3412",
    customer: { name: "Maryam Al Sayed", nameAr: "مريم السيد", cprLast4: "2906", account: "KS-774310", detail: "CPR card renewal · file opened 9 Nov" },
    tabs: [
      {
        id: "appointments", title: "Appointments", columns: ["Service", "When", "Where", "Status"],
        rows: [{ id: "apt-current", cells: ["CPR card renewal", "Sunday 22 Nov, 10:00", "Isa Town centre", "Confirmed"] }],
      },
      {
        id: "slots", title: "Free slots", columns: ["Day", "Time", "Where"],
        rows: [
          { id: "slot-tue-am", cells: ["Tuesday 24 Nov", "08:30", "Isa Town centre"] },
          { id: "slot-tue-pm", cells: ["Tuesday 24 Nov", "13:00", "Isa Town centre"] },
          { id: "slot-wed-am", cells: ["Wednesday 25 Nov", "09:15", "Muharraq centre"] },
        ],
      },
    ],
    form: {
      title: "Appointment change",
      fields: [
        { id: "service", label: "Service" },
        { id: "from", label: "Current appointment" },
        { id: "to", label: "New appointment" },
        { id: "reason", label: "Reason" },
        { id: "promised", label: "What we promised" },
      ],
    },
    kb: [
      {
        id: "reschedule", title: "Moving an appointment",
        body: [
          "Confirm the customer's full name and the last four digits of their CPR before opening the file.",
          "An appointment can be moved free of charge up to twenty-four hours before it starts.",
          "Open Free slots and offer the nearest two. Read the new day, time and centre back to the customer.",
          "Tell the customer an SMS confirming the new appointment arrives within a few minutes.",
          "Repeat back what was agreed, and check nothing else is needed.",
        ],
      },
      {
        id: "renewal-documents", title: "What to bring for an CPR card renewal",
        body: ["The current CPR card.", "Proof of address dated within the last three months.", "The renewal fee is paid at the centre by card."],
      },
    ],
    caller: {
      gender: "female",
      brief: "You have an CPR card renewal appointment on Sunday at ten in the morning at the Isa Town centre, but your daughter has a hospital appointment at the same time. You want to move it to another day next week, in the morning if possible, and you prefer Isa Town because it is close to home. Before the call ends, ask what you need to bring with you.",
      mood: "Calm, unhurried and courteous.",
      happyWhen: "The agent gives you a new day and time and tells you what to bring.",
      callback: "three three double-zero, seven four one six (a made-up number you give if asked for a callback number)",
    },
  },
};

export const SCENARIO_LIST = Object.values(SCENARIOS);

/** Config key for a caller agent, e.g. "telecom_ar". */
export const callerKey = (scenarioId, language) => `${scenarioId}_${language}`;

/** What the copilot is told about a scenario at the start of a call: screens, form and knowledge, but not the customer. */
export function packFor(s) {
  return JSON.stringify({
    client: s.client,
    screen_tabs: s.tabs.map((t) => ({ tab: t.id, title: t.title, rows: t.rows.map((r) => ({ row: r.id, shows: r.cells.filter(Boolean).join(" | ") })) })),
    case_form: { title: s.form.title, fields: s.form.fields.map((f) => ({ field: f.id, label: f.label })) },
    knowledge_cards: s.kb.map((k) => ({ card: k.id, title: k.title, steps: k.body.map((text, i) => ({ step: i + 1, text })), ...(k.caution ? { caution: k.caution } : {}) })),
  });
}
