// A small canvas orb that shows what a voice agent is doing, in the spirit of
// LiveKit's Aura visualizer. Quiet grey at rest, blue once a call is live.
//
//   const orb = createOrb(canvas);
//   orb.setState("idle" | "connecting" | "listening" | "thinking" | "speaking");
//   orb.setLevel(() => 0..1);   // optional live audio level

const IDLE = ["#ffffff", "#f1f5f9", "#e2e8f0", "#cbd5e1"];
const LIVE = ["#e0f2fe", "#7dd3fc", "#3b82f6", "#1e40af"];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};
const rgba = (h, a) => `rgba(${hex(h).join(",")},${a})`;

export function createOrb(canvas, { idleAlpha = 1 } = {}) {
  const ctx = canvas.getContext("2d");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let still = motion.matches;
  let state = "idle", level = () => 0;
  let live = 0, energy = 0.1, t = 0, last = performance.now(), running = false;

  // Draw only while something is changing; an idle orb that has settled stops.
  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  motion.addEventListener?.("change", (e) => { still = e.matches; wake(); });
  if (typeof ResizeObserver === "function") new ResizeObserver(wake).observe(canvas);

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w: canvas.width, h: canvas.height };
  }

  function target(now) {
    const l = Math.max(0, Math.min(1, level() || 0));
    if (still) return state === "idle" ? 0.08 : state === "speaking" ? 0.6 : 0.4;
    switch (state) {
      case "connecting": return 0.3 + 0.15 * Math.sin(now / 260);
      case "listening": return 0.35 + 0.4 * l;
      case "thinking": return 0.45 + 0.08 * Math.sin(now / 180);
      case "speaking": return Math.min(1, 0.5 + 0.5 * l);
      default: return 0.08;
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const on = state !== "idle";
    live += ((on ? 1 : 0) - live) * Math.min(1, dt * 3);
    energy += (target(now) - energy) * Math.min(1, dt * 8);
    if (!still) t += dt * (0.4 + energy * 1.6) * (state === "thinking" ? 2 : 1);

    const { w, h } = size();
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.34 * (1 + energy * 0.06);
    const c = (i) => mix(IDLE[i], LIVE[i], live);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = idleAlpha + (1 - idleAlpha) * live;

    // Soft halo, only once the call is live.
    const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.45);
    halo.addColorStop(0, rgba("#3b82f6", 0.22 * live * (0.5 + energy)));
    halo.addColorStop(1, rgba("#3b82f6", 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // Body: a circle whose edge breathes with the energy.
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const k = 1 + energy * 0.018 * Math.sin(3 * a + t * 2.1) + energy * 0.01 * Math.sin(5 * a - t * 2.7);
      ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k);
    }
    ctx.closePath();
    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.05);
    body.addColorStop(0, c(0));
    body.addColorStop(0.35, c(1));
    body.addColorStop(0.75, c(2));
    body.addColorStop(1, c(3));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.clip();

    // Light moving through the inside.
    ctx.globalCompositeOperation = "screen";
    const blobs = [["#67e8f9", 0.9, 0.55], ["#ffffff", -1.3, 0.4], ["#818cf8", 1.7, 0.5]];
    blobs.forEach(([col, speed, size], i) => {
      const a = t * speed + i * 2.1;
      const bx = cx + Math.cos(a) * r * 0.45, by = cy + Math.sin(a * 1.2) * r * 0.4;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r * size * (1 + energy * 0.4));
      g.addColorStop(0, rgba(col, (0.15 + 0.45 * energy) * live));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    const settled = state === "idle" && live < 0.002 && Math.abs(energy - 0.08) < 0.002;
    if (settled || (still && Math.abs(live - (on ? 1 : 0)) < 0.002)) running = false;
    else requestAnimationFrame(frame);
  }
  wake();

  return {
    setState(s) { if (s !== state) { state = s; wake(); } },
    setLevel(fn) { level = fn || (() => 0); wake(); },
  };
}
