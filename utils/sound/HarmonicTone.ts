import { Envelope, NotePlayer, Timbre } from "./SoundPlayer.ts";

export class HarmonicTone implements Timbre {
  public static readonly envelope: Envelope = {
    startSegments: [
      { type: "ValueAtTime", value: 0, offset: 0 },
      { type: "LinearRampToValue", value: 1, offset: 0.005 },
      { type: "ExponentialRampToValue", value: 0.6, offset: 0.03 },
      { type: "TargetAtTime", value: 0, offset: 0.1, timeConstant:  },
    ],
    endSegments: [],
  };

  renderSound(
    audioContext: AudioContext,
    startTime: number,
    duration: number,
    frequency: number,
    loudness: number = 1,
  ) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);

    oscillator.frequency.setValueAtTime(
      frequency,
      audioContext.currentTime,
    );

    const harmonicSeries = this.getHarmonicSeries(frequency);
    const waveform = audioContext.createPeriodicWave(
      harmonicSeries.real,
      harmonicSeries.imag,
    );
    oscillator.setPeriodicWave(waveform);

    // Adjust gain based on frequency for consistent volume across pitches, since
    // higher frequencies naturally sound louder.
    const normalizedVolume = loudness * Math.pow(440 / frequency, 0.3);

    // Amplitude envelope for plucking sound
    gainNode.gain.setValueAtTime(0, startTime); // Initial value
    gainNode.gain.linearRampToValueAtTime(
      normalizedVolume,
      startTime + 0.005,
    ); // Quick attack
    gainNode.gain.exponentialRampToValueAtTime(
      normalizedVolume * 0.6,
      startTime + 0.03,
    ); // Immediate slight decay
    gainNode.gain.exponentialRampToValueAtTime(
      normalizedVolume * 0.3,
      startTime + 0.1,
    ); // Further decay

    // Use setTargetAtTime for the final decay to zero
    const timeConstant = (duration - 0.1) / 5; // Adjust timeConstant as needed
    gainNode.gain.setTargetAtTime(0, startTime + 0.1, timeConstant); // Final decay toward zero

    // Start and stop the oscillator
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.5); // Stop after ensuring decay completes

    // Clean up each oscillator and gain node
    oscillator.onended = () => {
      gainNode.disconnect();
      oscillator.disconnect();
    };

    return gainNode;
  }

  getEnvelope(): Envelope {
    return HarmonicTone.envelope;
  }

  // Helpers
  // Continuous function to calculate harmonic series based on frequency
  private getHarmonicSeries(frequency: number) {
    const real = [];
    const imag = [];

    // Max number of harmonics to consider (adjust for desired overtones)
    const maxHarmonics = 10;
    for (let i = 0; i <= maxHarmonics; i++) {
      if (i === 0) {
        // Skip the 0th harmonic (DC offset)
        real.push(0);
        imag.push(0);
        continue;
      }

      // Continuous harmonic amplitude function
      const amplitude = Math.pow(frequency / 440, -0.5) * Math.pow(i, -0.8);

      // Adjust brightness for higher notes
      const brightnessFactor = 1 / (1 + (frequency - 440) / 880); // Smooth brightness reduction
      real.push(amplitude * brightnessFactor);
      imag.push(0); // No phase shift needed
    }

    return { real: new Float32Array(real), imag: new Float32Array(imag) };
  }
}
