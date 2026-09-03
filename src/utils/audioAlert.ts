/**
 * Web Audio API synthesized chimes for instant real-time sound notifications
 * Works natively across all mobile and desktop browsers with zero external audio assets
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext initialization failed:', e);
    return null;
  }
}

/**
 * Play a double-ding cash register / bell sound for incoming new orders
 */
export function playNewOrderSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: High crisp chime (E6 - ~1318 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1318.5, now);
    osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.15); // A6

    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);

    // Tone 2: Bright harmonic follow-up chime (E7 - ~2637 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now + 0.18);
    osc2.frequency.exponentialRampToValueAtTime(2093, now + 0.4); // C7

    gain2.gain.setValueAtTime(0.4, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.18);
    osc2.stop(now + 0.75);

    // Vibrate device if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch (e) {
    console.warn('Could not play new order sound:', e);
  }
}

/**
 * Play a subtle, pleasant notification chime for promo / offer notifications
 */
export function playOfferNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.2); // D6

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 150]);
    }
  } catch (e) {
    console.warn('Could not play offer sound:', e);
  }
}
