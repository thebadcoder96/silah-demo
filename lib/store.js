// The demo's call queue (server side only). Every call from every demo is one
// record here, and the quality desk reads them all. A call never changes once
// saved; its score is kept beside it, so a call can be scored (or re-scored)
// after it ends.
//
// Local: one JSON file, .data/queue.json.
// On Vercel: a private Vercel Blob store connected to the project, one small
// JSON blob per call (calls/SIL-1001.json) and per score (scores/SIL-1001.json).
// Function instances do not share a disk, so the file version cannot be used there.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIRST_ID = 1001;
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const numberOf = (id) => Number(String(id).replace(/\D/g, ""));
const stamp = (record, n) => ({ id: `SIL-${n}`, createdAt: new Date().toISOString(), ...record });
let queue = Promise.resolve(); // serialise writes within one instance
const inOrder = (work) => {
  const run = queue.then(work);
  queue = run.catch(() => {});
  return run;
};

// ---------- local file ----------

const file = join(dirname(fileURLToPath(import.meta.url)), "..", ".data", "queue.json");
const readLocal = () => readFile(file, "utf8").then(JSON.parse, () => ({ calls: [], scores: {} }));
async function writeLocal(data) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

// ---------- Vercel Blob ----------

const CALLS = "calls/";
const SCORES = "scores/";
const seen = new Map(); // pathname -> { at, record }; re-read only when the blob was written again
const blob = () => import("@vercel/blob");

async function blobList(prefix) {
  const { list } = await blob();
  const found = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor });
    found.push(...page.blobs.map((b) => ({ path: b.pathname, at: +new Date(b.uploadedAt) })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return found;
}

async function blobRecords(prefix) {
  const { get } = await blob();
  const found = await blobList(prefix);
  const paths = new Set(found.map((f) => f.path));
  for (const gone of [...seen.keys()].filter((p) => p.startsWith(prefix) && !paths.has(p))) seen.delete(gone);
  await Promise.all(
    found
      .filter((f) => seen.get(f.path)?.at !== f.at)
      .map(async (f) => {
        const got = await get(f.path, { access: "private" });
        if (got?.stream) seen.set(f.path, { at: f.at, record: JSON.parse(await new Response(got.stream).text()) });
      }),
  );
  return found.map((f) => seen.get(f.path)?.record).filter(Boolean);
}

const putJson = async (path, record, overwrite = false) => {
  const { put } = await blob();
  await put(path, JSON.stringify(record), { access: "private", addRandomSuffix: false, allowOverwrite: overwrite, contentType: "application/json" });
};

// ---------- the store ----------

// Every failure inside the store is rethrown as a StoreError, so callers can
// tell it apart from other errors. @vercel/blob's error classes do not set
// .name, so matching on names is not reliable.
class StoreError extends Error {
  constructor(cause) {
    super(`Demo store: ${cause?.message || cause}`, { cause });
    this.name = "StoreError";
  }
}
const guard = (work) => async (...args) => {
  try {
    return await work(...args);
  } catch (err) {
    throw err instanceof StoreError ? err : new StoreError(err);
  }
};

/** True when an error came from the demo store. */
export const isStoreError = (err) => err instanceof StoreError;

/** Every call, newest first, each with its score (or null). */
export const listCalls = guard(async () => {
  let calls, scores;
  if (useBlob) {
    const [c, s] = await Promise.all([blobRecords(CALLS), blobRecords(SCORES)]);
    calls = c;
    scores = Object.fromEntries(s.map((x) => [x.callId, x]));
  } else {
    ({ calls, scores } = await readLocal());
  }
  return calls
    .slice()
    .sort((a, b) => numberOf(b.id) - numberOf(a.id))
    .map((call) => ({ ...call, score: scores[call.id] || null }));
});

/** One call with its score, or null. */
export const getCall = guard(async (id) => (await listCalls()).find((c) => c.id === id) || null);

/** Save a new call and give it the next reference number. */
export const addCall = guard((record) =>
  inOrder(async () => {
    if (!useBlob) {
      const data = await readLocal();
      const saved = stamp(record, data.calls.length ? Math.max(...data.calls.map((c) => numberOf(c.id))) + 1 : FIRST_ID);
      data.calls.push(saved);
      await writeLocal(data);
      return saved;
    }
    for (let attempt = 0; ; attempt++) {
      const taken = (await blobList(CALLS)).map((f) => numberOf(f.path));
      const saved = stamp(record, taken.length ? Math.max(...taken) + 1 : FIRST_ID);
      try {
        await putJson(`${CALLS}${saved.id}.json`, saved);
        return saved;
      } catch (err) {
        // Another instance took this number at the same moment: pick the next one.
        if (attempt >= 4) throw err;
      }
    }
  }),
);

/** Attach (or replace) the score for a call. */
export const saveScore = guard((callId, score) =>
  inOrder(async () => {
    const saved = { callId, scoredAt: new Date().toISOString(), ...score };
    if (!useBlob) {
      const data = await readLocal();
      data.scores[callId] = saved;
      await writeLocal(data);
    } else {
      await putJson(`${SCORES}${callId}.json`, saved, true);
    }
    return saved;
  }),
);

// ---------- live state ----------
// A phone call has no browser, so the agent's tools write what they know here
// and the page reads it. Each write is a new blob (an overwritten blob can be
// served stale for a while), and reading takes the newest.

const LIVE = "live/";
const liveFile = join(dirname(file), "live.json");
const readLive = () => readFile(liveFile, "utf8").then(JSON.parse, () => ({}));

/** Replace the live state kept under a name. */
export const setLive = guard(async (name, value) => {
  const record = { ...value, at: Date.now() };
  if (!useBlob) {
    const all = await readLive();
    all[name] = record;
    await mkdir(dirname(liveFile), { recursive: true });
    await writeFile(liveFile, JSON.stringify(all));
    return record;
  }
  const old = await blobList(`${LIVE}${name}/`);
  await putJson(`${LIVE}${name}/${record.at}.json`, record);
  if (old.length) (await blob()).del(old.map((f) => f.path)).catch(() => {});
  return record;
});

/** The live state kept under a name, or null. */
export const getLive = guard(async (name) => {
  if (!useBlob) return (await readLive())[name] || null;
  const newest = (await blobList(`${LIVE}${name}/`)).sort((a, b) => b.path.localeCompare(a.path))[0];
  if (!newest) return null;
  const got = await (await blob()).get(newest.path, { access: "private" });
  return got?.stream ? JSON.parse(await new Response(got.stream).text()) : null;
});

/** Empty the queue (demo reset). */
export const clearCalls = guard(() =>
  inOrder(async () => {
    if (!useBlob) return writeLocal({ calls: [], scores: {} });
    const { del } = await blob();
    const paths = [...(await blobList(CALLS)), ...(await blobList(SCORES))].map((f) => f.path);
    if (paths.length) await del(paths);
    seen.clear();
  }),
);
