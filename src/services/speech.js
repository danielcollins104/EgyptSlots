// Read-aloud service built on the browser's Web Speech API (no network calls, no extra dependencies:
// text never leaves the device). Picks the most natural-sounding installed voice and speaks long text in
// sentence-sized chunks (some browsers silently cut off long utterances).

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export const speechSupported = () => Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function');

// Higher score = more human-sounding. Neural/"Natural" voices (Edge, Windows 11), Google network voices (Chrome),
// and Apple's premium/enhanced voices beat the robotic legacy defaults.
const PREFERRED = [
  [/natural|neural/i, 100],
  [/\b(aria|jenny|guy|ava|andrew|emma|brian)\b/i, 80],
  [/premium|enhanced/i, 70],
  [/google (us|uk) english/i, 60],
  [/\b(samantha|allison|evan|nicky|karen|daniel|serena)\b/i, 50],
];

let cachedVoice = null;
export function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices.length) return null;
  if (cachedVoice && voices.includes(cachedVoice)) return cachedVoice;
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const base = lang.split('-')[0];
  let best = null;
  let bestScore = -1;
  for (const v of voices) {
    if (!v.lang || !v.lang.toLowerCase().startsWith(base.toLowerCase())) continue;
    let score = v.lang.toLowerCase() === lang.toLowerCase() ? 10 : 0;
    for (const [re, pts] of PREFERRED) if (re.test(v.name)) score += pts;
    if (v.localService === false) score += 5; // network voices tend to be higher quality
    if (/espeak|compact/i.test(v.name)) score -= 50;
    if (score > bestScore) { best = v; bestScore = score; }
  }
  cachedVoice = best || voices[0];
  return cachedVoice;
}

if (synth && typeof synth.addEventListener === 'function') {
  synth.addEventListener('voiceschanged', () => { cachedVoice = null; });
}

/** Turns on-screen text into something that sounds natural when spoken. */
export function prepareSpeechText(raw) {
  return String(raw || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ') // emoji / pictographs
    .replace(/\bGC\b/g, 'Gold Coins')
    .replace(/\bSC\b/g, 'Sweeps Coins')
    .replace(/\bAMOE\b/g, 'A M O E')
    .replace(/\bLLC\b/g, 'L L C')
    .replace(/\bRTP\b/g, 'R T P')
    .replace(/(\d)\s*[×x](?![A-Za-z])/g, '$1 times')
    .replace(/&/g, ' and ')
    .replace(/[•·|]/g, '. ')
    .replace(/\s*[\r\n]+\s*/g, '. ')
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function chunk(text, max = 220) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > max && cur) { out.push(cur.trim()); cur = ''; }
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

let token = 0;
let activeStop = null;

export function stopSpeaking() {
  token++;
  if (synth) synth.cancel();
  if (activeStop) { const f = activeStop; activeStop = null; f(); }
}

/** Speaks `text`; resolves when finished or stopped. Only one reading plays at a time. */
export function speak(text, { rate = 0.97, pitch = 1, onEnd } = {}) {
  if (!speechSupported()) return false;
  stopSpeaking();
  const parts = chunk(prepareSpeechText(text));
  if (!parts.length) return false;
  const mine = ++token;
  const done = () => { if (onEnd) onEnd(); };
  activeStop = done;
  const voice = pickVoice();
  let i = 0;
  const next = () => {
    if (mine !== token) return;
    if (i >= parts.length) { activeStop = null; done(); return; }
    const u = new window.SpeechSynthesisUtterance(parts[i++]);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = rate;
    u.pitch = pitch;
    u.onend = next;
    u.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') return; if (mine === token) { activeStop = null; done(); } };
    synth.speak(u);
  };
  next();
  return true;
}
