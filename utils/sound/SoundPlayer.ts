import { HarmonicTone } from "./HarmonicTone.ts";
import { PureTone } from "./PureTone.ts";

/**
 * Generic type for a function that will play a single note. Each
 * implementation designs its own timbre. It should
 */
export type NotePlayer = (
  audioContext: AudioContext,
  startTime: number,
  duration: number,
  frequency: number,
  loudness: number,
) => AudioNode;

export type EnvelopeValueAtTime = {
  type: "ValueAtTime";
  value: number;
  offset: number;
};
export type EnvelopeLinearRampToValue = {
  type: "LinearRampToValue";
  value: number;
  offset: number;
};
export type EnvelopeExponentialRampToValue = {
  type: "ExponentialRampToValue";
  value: number;
  offset: number;
};
export type EnvelopeTargetAtTime = {
  type: "TargetAtTime";
  value: number;
  offset: number;
  timeConstant: number;
};
export type EnvelopeSegment =
  | EnvelopeValueAtTime
  | EnvelopeLinearRampToValue
  | EnvelopeExponentialRampToValue
  | EnvelopeTargetAtTime;

export type Envelope = {
  startSegments: EnvelopeSegment[];
  endSegments: EnvelopeSegment[];
};

export interface Timbre {
  renderSound(
    audioContext: AudioContext,
    startTime: number,
    duration: number,
    frequency: number,
    loudness: number,
  ): AudioNode;

  getEnvelope(): Envelope;
}

export interface Note {
  frequency: number; // Frequency in Hz
  duration: number; // Duration in milliseconds
  offset: number; // Offset from sequence start in milliseconds
  loudness?: number | null | undefined;
  notePlayer?: NotePlayer;
}

export class SoundPlayer {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;

  constructor() {
    // Defer AudioContext creation until first user interaction
    // to comply with browser autoplay policies
  }

  private initializeIfNeeded() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      // Create a master gain node for overall volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  // Convert milliseconds to AudioContext time
  private msToContextTime(milliseconds: number): number {
    if (!this.audioContext) return 0;
    return this.audioContext.currentTime + (milliseconds / 1000);
  }

  // Schedule a single note at a specific time
  private scheduleNote(
    frequency: number,
    startTime: number,
    duration: number,
    loudness: number,
    timbre: Timbre,
  ) {
    if (!this.audioContext || !this.gainNode) return;

    timbre.renderSound(
      this.audioContext,
      startTime,
      duration,
      frequency,
      loudness,
    ).connect(this.gainNode);
  }

  // Play a single tone (maintaining backward compatibilxity)
  playPureTone(frequency: number, duration: number, loudness: number = 1) {
    this.initializeIfNeeded();
    if (!this.audioContext) return;

    const startTime = this.audioContext.currentTime;
    this.scheduleNote(frequency, startTime, duration, loudness, new PureTone());
  }

  // Play a sequence of notes
  playMusic(notes: Note[]) {
    this.initializeIfNeeded();
    if (!this.audioContext) return;

    // Get the current time as our reference point
    const sequenceStartTime = this.audioContext.currentTime;

    // Schedule each note relative to the sequence start time
    notes.forEach((note) => {
      const noteStartTime = sequenceStartTime + (note.offset);
      this.scheduleNote(
        note.frequency,
        noteStartTime,
        note.duration,
        note.loudness ?? 1,
        note.timbre ?? new harmonicTone(),
      );
    });
  }

  // Utility method to stop all sound immediately
  stopAll() {
    if (!this.audioContext || !this.gainNode) return;

    // Quickly ramp down the master gain to silence
    this.gainNode.gain.linearRampToValueAtTime(
      0,
      this.audioContext.currentTime + 0.1,
    );

    // Create a new gain node for future sounds
    this.gainNode.disconnect();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }
}

// Client-side singleton pattern (unchanged)
let soundPlayerInstance: SoundPlayer | null = null;

export function getSoundPlayer(): SoundPlayer {
  if (!soundPlayerInstance) {
    soundPlayerInstance = new SoundPlayer();
  }
  return soundPlayerInstance;
}

export function applyEnvelope(
  gainNode: GainNode,
  envelope: Envelope,
  startTime: number,
  duration: number,
  loudness: number,
) {
  for (const startSegment of envelope.startSegments) {
    if (startSegment.type === "ValueAtTime") {
      gainNode.gain.setValueAtTime(
        startSegment.value * loudness,
        startTime + startSegment.offset,
      );
    } else if (startSegment.type === "LinearRampToValue") {
      gainNode.gain.linearRampToValueAtTime(
        startSegment.value * loudness,
        startTime + startSegment.offset,
      );
    } else if (startSegment.type === "ExponentialRampToValue") {
      gainNode.gain.exponentialRampToValueAtTime(
        startSegment.value * loudness,
        startTime + startSegment.offset,
      );
    } else if (startSegment.type === "TargetAtTime") {
      gainNode.gain.setTargetAtTime(
        startSegment.value * loudness,
        startTime + startSegment.offset,
        startSegment.timeConstant,
      );
    }
  }

  for (const endSegment of envelope.endSegments) {
    if (endSegment.type === "ValueAtTime") {
      gainNode.gain.setValueAtTime(
        endSegment.value * loudness,
        startTime + duration - endSegment.offset,
      );
    } else if (endSegment.type === "LinearRampToValue") {
      gainNode.gain.linearRampToValueAtTime(
        endSegment.value * loudness,
        startTime + duration - endSegment.offset,
      );
    } else if (endSegment.type === "ExponentialRampToValue") {
      gainNode.gain.exponentialRampToValueAtTime(
        endSegment.value * loudness,
        startTime + duration - endSegment.offset,
      );
    } else if (endSegment.type === "TargetAtTime") {
      gainNode.gain.setTargetAtTime(
        endSegment.value * loudness,
        startTime + duration - endSegment.offset,
        endSegment.timeConstant,
      );
    }
  }
}
