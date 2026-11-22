// Server side: which share link a request to this demo's API came from.
// The pages send the gateway's visit in the x-mmi-visit header (see visit.js).

const GATEWAY = (process.env.GATEWAY_URL || "https://demos.mmintelligence.ai").replace(/\/$/, "");

const visitOf = (req) => String(req?.headers?.["x-mmi-visit"] || "");

/**
 * The storage name for the caller's share link. "shared" when there is none:
 * calls to the real phone number, the seeded examples, and visitors the gateway did not see.
 */
export function bucketOf(req) {
  const bucket = visitOf(req).split(".")[0];
  return /^[a-z0-9-]{3,80}$/.test(bucket) ? bucket : "shared";
}

const bucketIn = (record) => record.bucket || "shared";

/** A call is shown to its own link, and to everyone when it belongs to no link. Staff see all. */
export const visibleTo = (bucket) => (record) => bucket === "staff" || bucketIn(record) === "shared" || bucketIn(record) === bucket;

/** Clearing the queue removes only the caller's own calls, so one prospect cannot empty another's or the examples. Staff clear all. */
export const clearableBy = (bucket) => (record) => bucket === "staff" || bucketIn(record) === bucket;

/**
 * Ask the gateway whether this visitor may place an outbound phone call. It counts the call if so.
 * Returns { ok, reason }. Running locally (not on Vercel) there is no gateway visit, so calls are allowed.
 */
export async function mayDial(req) {
  const visit = visitOf(req);
  if (!visit && !process.env.VERCEL) return { ok: true };
  if (!visit) return { ok: false, reason: "Open this demo from the link we sent you to place a call." };
  try {
    const res = await fetch(`${GATEWAY}/api/demo/dial`, { method: "POST", body: JSON.stringify({ visit }), signal: AbortSignal.timeout(8000) });
    const out = await res.json();
    return out.ok ? { ok: true } : { ok: false, reason: out.reason || "This link cannot place calls right now." };
  } catch {
    return { ok: false, reason: "Calls are unavailable for a moment. Please try again." };
  }
}
