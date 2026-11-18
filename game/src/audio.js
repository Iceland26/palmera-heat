// Synthesised WebAudio sound — no audio files. Engine, siren, gunshots,
// mission stings and a soft sea wash, all generated. Everything is guarded:
// if audio is unavailable the game simply stays silent.
export function createAudio() {
  let ctx = null, master = null, muted = false;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      // sea wash: looped filtered noise, very low
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0.035;
      src.connect(f); f.connect(g); g.connect(master); src.start();
      return true;
    } catch { ctx = null; return false; }
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 300;
      engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch { /* ignore */ }
  }
  function engine(speedRatio, throttle) {
    if (!engineOsc || muted) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(50 + speedRatio * 165 + throttle * 25, t, 0.06);
    engineFilter.frequency.setTargetAtTime(240 + speedRatio * 900, t, 0.08);
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075 + speedRatio * 0.03, t, 0.09);
  }
  function stopEngine() {
    if (!engineOsc) return;
    try { engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); const o = engineOsc; setTimeout(() => { try { o.stop(); } catch {} }, 220); } catch {}
    engineOsc = null;
  }

  function setSiren(on) {
    if (!ctx || muted) on = false;
    if (on && !sirenOsc) {
      try {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 720;
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.028;
        sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      } catch { sirenOsc = null; }
    } else if (!on && sirenOsc) {
      try { sirenOsc.stop(); } catch {} sirenOsc = null;
    }
  }
  function tickSiren(dt) {
    if (!sirenOsc) return;
    sirenTimer += dt;
    if (sirenTimer > 0.42) { sirenTimer = 0; sirenHigh = !sirenHigh; sirenOsc.frequency.setTargetAtTime(sirenHigh ? 960 : 715, ctx.currentTime, 0.03); }
  }

  function shot() {
    if (!ensure() || muted) return;
    try {
      const dur = 0.13, buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    } catch { /* ignore */ }
  }

  function sting(good = true) {
    if (!ensure() || muted) return;
    try {
      const notes = good ? [523, 659, 784, 1046] : [392, 330, 262, 196];
      notes.forEach((n, i) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = n;
        const g = ctx.createGain(); const t0 = ctx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
        o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.4);
      });
    } catch { /* ignore */ }
  }

  function cashSound() {
    if (!ensure() || muted) return;
    try {
      [1318, 1760].forEach((n, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = n;
        const g = ctx.createGain(); const t0 = ctx.currentTime + i * 0.07;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.26);
      });
    } catch { /* ignore */ }
  }

  return {
    unlock: ensure,
    startEngine, engine, stopEngine, setSiren, tickSiren, shot, sting, cashSound,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; if (muted) setSiren(false); return muted; },
    get muted() { return muted; },
  };
}
