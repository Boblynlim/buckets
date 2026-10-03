// Ceramic cup clinks for the passcode keypad. Each digit is its own cup:
// a different note (major pentatonic, so any code sounds pleasant) and a
// slightly different glaze (partial ratios), like tapping real cups.
//
// A struck cup rings with a few inharmonic partials that die away at
// different speeds, plus a very short "tick" where the spoon hits.

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// C major pentatonic across two octaves; 0 sits lowest, like the biggest cup.
const NOTE: Record<string, number> = {
  '0': 880.0, // A5
  '1': 1046.5, // C6
  '2': 1174.7, // D6
  '3': 1318.5, // E6
  '4': 1568.0, // G6
  '5': 1760.0, // A6
  '6': 2093.0, // C7
  '7': 2349.3, // D7
  '8': 2637.0, // E7
  '9': 3136.0, // G7
};

// Partial ratios for small porcelain cups (roughly a cup's bending modes).
// Each digit nudges them a little so no two cups sound identical.
const PARTIALS = [
  { ratio: 1, gain: 1, decay: 0.9 },
  { ratio: 2.71, gain: 0.32, decay: 0.45 },
  { ratio: 5.12, gain: 0.12, decay: 0.22 },
  { ratio: 8.3, gain: 0.05, decay: 0.12 },
];

export function playClink(digit: string, volume = 0.16) {
  const ac = audio();
  if (!ac) return;
  const base = NOTE[digit] ?? 1046.5;
  const n = Number(digit) || 0;
  const t = ac.currentTime + 0.005;

  const out = ac.createGain();
  out.gain.value = volume;
  // Gentle high shelf keeps it bright but not piercing.
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 9000;
  out.connect(tone).connect(ac.destination);

  PARTIALS.forEach((p, i) => {
    const glaze = 1 + ((n * 7 + i * 3) % 5 - 2) * 0.006; // each cup slightly different
    const f = base * p.ratio * glaze;
    if (f > 16000) return;
    // Two oscillators a hair apart give the slow shimmer of real ceramic.
    for (const detune of [-0.0015, 0.0015]) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = f * (1 + detune);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p.gain * 0.5, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay * (1 - n * 0.02));
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + p.decay + 0.05);
    }
  });

  // The strike: a 10ms burst of filtered noise.
  const len = Math.floor(ac.sampleRate * 0.012);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = base * 3;
  bp.Q.value = 1.2;
  const ng = ac.createGain();
  ng.gain.value = 0.35;
  noise.connect(bp).connect(ng).connect(out);
  noise.start(t);
}

// Delete: a soft, low tap on the shelf wood.
export function playTap(volume = 0.12) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.14);
}

// Unlocked: three cups, rising.
export function playUnlock() {
  ['1', '4', '6'].forEach((d, i) => setTimeout(() => playClink(d, 0.12), i * 90));
}
