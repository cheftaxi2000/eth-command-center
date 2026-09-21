/**
 * Dictation for the assistant: speak, and the words land in the input field (the user sends).
 *
 * 1. Web Speech API where the browser has it (Chrome, Edge, Safari): words appear live.
 * 2. Otherwise (Firefox, some home-screen web apps) record the microphone, convert to a small WAV
 *    and let Gemini transcribe it – needs the Gemini key, text appears after stopping.
 */

export type VoiceMode = 'live' | 'record' | 'none';
export type VoiceState = 'idle' | 'listening' | 'transcribing';

export interface DictationHandlers {
  /** Current best text. `final` = recording is over, nothing more will come. */
  onText: (text: string, final: boolean) => void;
  onState: (state: VoiceState) => void;
  onError: (message: string) => void;
}

export interface Dictation {
  stop: () => void;
}

/* ---------- Web Speech API (not in TypeScript's DOM lib everywhere) ---------- */

interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const canRecord = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/** Which kind of dictation this browser can do; `hasKey` = a Gemini key is saved on this device. */
export function voiceMode(hasKey: boolean): VoiceMode {
  if (recognitionCtor()) return 'live';
  if (hasKey && canRecord()) return 'record';
  return 'none';
}

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Mikrofon blockiert – erlaube es über das Schloss-Symbol in der Adressleiste.',
  'service-not-allowed': 'Die Spracherkennung ist in diesem Browser gesperrt.',
  'no-speech': 'Ich habe nichts gehört – nochmal versuchen?',
  'audio-capture': 'Kein Mikrofon gefunden.',
  network: 'Die Spracherkennung braucht eine Internetverbindung.',
};

function startLive(Ctor: RecognitionCtor, h: DictationHandlers): Dictation {
  let finalText = '';
  let stopped = false;
  let lang = 'de-CH';

  const run = () => {
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      h.onText(`${finalText}${interim}`.replace(/\s+/g, ' ').trim(), false);
    };
    rec.onerror = (e) => {
      // Swiss German model missing in this browser → retry once with standard German
      if (e.error === 'language-not-supported' && lang !== 'de-DE') {
        lang = 'de-DE';
        rec.onend = null;
        run();
        return;
      }
      if (e.error !== 'aborted') h.onError(MESSAGES[e.error] ?? `Spracherkennung: ${e.error}`);
    };
    rec.onend = () => {
      stopped = true;
      h.onText(finalText.replace(/\s+/g, ' ').trim(), true);
      h.onState('idle');
    };
    current = rec;
    rec.start();
  };

  let current: RecognitionLike | null = null;
  h.onState('listening');
  run();
  return {
    stop: () => {
      if (!stopped) current?.stop();
    },
  };
}

/* ---------- recording + Gemini transcription ---------- */

/** 16-bit PCM mono WAV – the format Gemini reliably accepts. Pure, unit-tested. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const RATE = 16_000;
const MAX_SECONDS = 90;

async function toWav16k(blob: Blob): Promise<Uint8Array> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.ceil(decoded.duration * RATE);
    const offline = new OfflineAudioContext(1, Math.max(1, frames), RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), RATE);
  } finally {
    void ctx.close();
  }
}

function startRecording(h: DictationHandlers, transcribe: (wavBase64: string) => Promise<string>): Dictation {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let cancelled = false;
  let limit: number | undefined;
  const chunks: Blob[] = [];

  const finish = async () => {
    stream?.getTracks().forEach((t) => t.stop());
    window.clearTimeout(limit);
    if (cancelled) return;
    h.onState('transcribing');
    try {
      const wav = await toWav16k(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
      if (wav.length <= 44 + RATE / 5) throw new Error('Die Aufnahme war zu kurz.'); // < 0.1 s of audio
      h.onText((await transcribe(toBase64(wav))).trim(), true);
    } catch (err) {
      h.onError(err instanceof Error ? err.message : String(err));
      h.onText('', true);
    } finally {
      h.onState('idle');
    }
  };

  h.onState('listening');
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((s) => {
      stream = s;
      if (cancelled) return s.getTracks().forEach((t) => t.stop());
      recorder = new MediaRecorder(s);
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => void finish();
      recorder.start();
      limit = window.setTimeout(() => recorder?.state === 'recording' && recorder.stop(), MAX_SECONDS * 1000);
    })
    .catch((err: DOMException) => {
      h.onError(err?.name === 'NotAllowedError' ? MESSAGES['not-allowed'] : err?.name === 'NotFoundError' ? MESSAGES['audio-capture'] : 'Mikrofon nicht verfügbar.');
      h.onState('idle');
    });

  return {
    stop: () => {
      if (recorder?.state === 'recording') recorder.stop();
      else {
        cancelled = true;
        stream?.getTracks().forEach((t) => t.stop());
        h.onState('idle');
      }
    },
  };
}

/** Starts dictation in the best available mode. `transcribe` is only used by the recording fallback. */
export function startDictation(h: DictationHandlers, transcribe?: (wavBase64: string) => Promise<string>): Dictation | null {
  const Ctor = recognitionCtor();
  if (Ctor) return startLive(Ctor, h);
  if (transcribe && canRecord()) return startRecording(h, transcribe);
  h.onError('Dieser Browser kann nicht diktieren. In Chrome, Edge oder Safari geht es – oder mit Gemini-Schlüssel auch hier.');
  return null;
}
