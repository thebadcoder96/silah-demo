// The one quality standard every call is scored against, whoever handled it.
// Shared by the quality desk (to show the criteria) and the scorer (to judge them).
// Change the standard here and nowhere else.

/** Each criterion ends up as pass, fail or unknown, with the transcript line that shows it. */
export const CRITERIA = [
  { id: "greeting", label: "Greeting", what: "The agent opens with a greeting and says which company they are speaking for." },
  { id: "disclosure", label: "Says it is an AI", what: "An AI agent says it is an AI assistant at the start of the call.", appliesTo: "AI" },
  { id: "identity", label: "Identity check", what: "The agent confirms who the customer is before sharing or changing any account detail." },
  { id: "resolution", label: "Resolution", what: "The reason for the call is dealt with, or a clear next step is agreed." },
  { id: "recap", label: "Recap", what: "The agent repeats back what was agreed before ending." },
  { id: "courtesy", label: "Courtesy", what: "The agent stays polite and patient throughout, and never talks over the customer." },
  { id: "closing", label: "Closing", what: "The agent asks if there is anything else and closes the call properly." },
];

/** Things a supervisor wants to know about straight away. */
export const FLAGS = {
  missed_identity_check: "Missed identity check",
  customer_upset: "Customer upset",
  promised_callback: "Promised a callback",
  asked_for_person: "Asked for a person",
  do_not_call: "Asked not to be called again",
};

/** The criteria that apply to a call handled by "AI" or "Human". */
export const criteriaFor = (handledBy) => CRITERIA.filter((c) => !c.appliesTo || c.appliesTo === handledBy);
