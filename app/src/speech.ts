import * as Speech from "expo-speech";

/** TTS delivery for the current persona, supplied by the server's persona engine. */
export type VoiceProfile = { rate: number; pitch: number };

export const DEFAULT_VOICE: VoiceProfile = { rate: 1.0, pitch: 1.0 };

/**
 * Speak a chunk of coach text. Calls queue, so feeding sentences as they stream
 * in produces a natural, continuous delivery rather than one big utterance at the end.
 */
export function speak(text: string, voice: VoiceProfile): void {
  const clean = sanitize(text);
  if (!clean) return;
  Speech.speak(clean, {
    rate: voice.rate,
    pitch: voice.pitch,
    // Clamp defensively in case a profile ever arrives out of range.
  });
}

/** Stop any in-progress and queued speech (new message, mute, or screen leave). */
export function stopSpeaking(): void {
  Speech.stop();
}

/**
 * Pull complete sentences off a growing buffer so we can speak them as they finish.
 * Returns the finished sentences and the leftover partial tail to keep buffering.
 */
export function drainSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const re = /[^.!?\n]+[.!?]+["')\]]*(?:\s+|$)|[^.!?\n]+\n+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(buffer)) !== null) {
    const s = match[0].trim();
    if (s) sentences.push(s);
    lastIndex = re.lastIndex;
  }
  return { sentences, rest: buffer.slice(lastIndex) };
}

/** Strip markdown/emoji noise that TTS would read awkwardly. */
function sanitize(text: string): string {
  return text
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
