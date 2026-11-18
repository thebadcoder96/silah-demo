// Plays a call's recorded lines, one file per line of the transcript
// (<base>1.mp3, <base>2.mp3, ...). Used by the campaign desk and the quality desk.

export function createPlayer() {
  let audio = null;
  let settle = null; // finishes the line that is playing, so stopping never leaves anyone waiting
  let run = 0; // changes whenever playback is started or stopped

  function halt() {
    audio?.pause();
    audio = null;
    settle?.(false);
  }

  /** Play one file. Resolves true when it played to the end, false if it was stopped or could not play. */
  function file(url) {
    halt();
    return new Promise((done) => {
      settle = (ok) => { settle = null; audio = null; done(ok); };
      audio = new Audio(url);
      audio.onended = () => settle?.(true);
      audio.onerror = () => settle?.(false);
      audio.play().catch(() => settle?.(false));
    });
  }

  return {
    /** Play line n (1-based) of a call. */
    line(base, n) {
      run++;
      return file(`${base}${n}.mp3`);
    },
    /** Play a whole call. onLine(index) is called as each line starts, and onLine(-1) when it ends or is stopped. */
    async all(base, count, onLine = () => {}) {
      const mine = ++run;
      for (let n = 1; n <= count && mine === run; n++) {
        onLine(n - 1);
        if (!(await file(`${base}${n}.mp3`))) break;
      }
      if (mine === run) run++;
      onLine(-1);
    },
    stop() {
      run++;
      halt();
    },
    playing: () => Boolean(audio),
  };
}
