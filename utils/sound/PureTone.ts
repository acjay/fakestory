import { applyEnvelope, Envelope, Timbre } from "./SoundPlayer.ts";

const attackTime = 0.01; // 10ms attack
const releaseTime = 0.01; // 10ms release

export class PureTone implements Timbre {
  // Slight envelope to avoid clicks
  public static readonly envelope: Envelope = {
    startSegments: [
      { type: "ValueAtTime", value: 0, offset: 0 },
      { type: "LinearRampToValue", value: 1, offset: attackTime },
    ],
    endSegments: [
      { type: "ValueAtTime", value: 1, offset: releaseTime },
      { type: "LinearRampToValue", value: 0, offset: 0 },
    ],
  };

  renderSound(
    audioContext: AudioContext,
    startTime: number,
    duration: number,
    frequency: number,
    loudness: number = 1,
  ) {
    const oscillator = audioContext.createOscillator();
    const noteGain = audioContext.createGain();
    oscillator.connect(noteGain);

    oscillator.frequency.value = frequency;

    // Add slight envelope to avoid clicks
    applyEnvelope(noteGain, PureTone.envelope, startTime, duration, loudness);

    // Schedule note start and cleanup
    oscillator.start(startTime);
    oscillator.stop(startTime + (duration / 1000));
    oscillator.onended = () => {
      oscillator.disconnect();
      noteGain.disconnect();
    };

    return noteGain;
  }

  getEnvelope(): Envelope {
    return PureTone.envelope;
  }
}
