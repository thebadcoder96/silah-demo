// Voice test rig, loaded only when the copilot page is opened with ?voicetest.
// It replaces the microphone with a stream that plays recorded lines, so a
// voice call can be tested with nobody at a microphone: speech-to-text on the
// agent's side, turn-taking and the customer's spoken replies all run for real.
// The lines come from scripts/make-test-audio.mjs (test-audio/, local only).
//
//   voiceTest.play("/test-audio/bank-ar/1.mp3")   say one line into the call
//   voiceTest.heard()                              what the customer's audio level has been

const ctx = new AudioContext();
const mic = ctx.createGain(); // every fake microphone is fed from here
let last = null;
const meter = ctx.createAnalyser(); // what is going into the fake microphone
let asked = 0; // how many times the page asked for the microphone
navigator.mediaDevices.getUserMedia = async () => {
  asked++;
  await ctx.resume();
  // A new stream each time: the page stops the first one it is given (the permission check).
  last = ctx.createMediaStreamDestination();
  mic.connect(last);
  return last.stream;
};

window.voiceTest = {
  /** Play one recorded line as if the agent said it. Resolves when the line has finished. */
  async play(url) {
    await ctx.resume();
    const audio = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const source = ctx.createBufferSource();
    source.buffer = audio;
    source.connect(mic);
    source.connect(meter);
    source.start();
    await new Promise((done) => (source.onended = done));
    return audio.duration;
  },
  /** For checking the rig itself: context state, microphone requests, the track, and the level right now. */
  state() {
    const data = new Uint8Array(meter.fftSize);
    meter.getByteTimeDomainData(data);
    const track = last?.stream.getAudioTracks()[0];
    return { context: ctx.state, asked, track: track ? `${track.readyState} enabled=${track.enabled}` : "none", level: Math.max(...data) - 128 };
  },
};
