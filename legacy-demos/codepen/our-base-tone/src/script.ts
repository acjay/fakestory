import React from 'https://esm.sh/react@18.2.0'
import ReactDOM from 'https://esm.sh/react-dom@18.2.0'

function playGuitarChord(frequencies, duration) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 0.7; // Overall volume control

    frequencies.forEach(frequency => {
        // Create an oscillator and gain node for each frequency
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Connect nodes: oscillator -> gainNode -> masterGain
        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        // Set the base frequency
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        // Create a custom harmonic structure based on a continuous function
        const harmonicSeries = getHarmonicSeries(frequency);
        const customWaveform = audioCtx.createPeriodicWave(harmonicSeries.real, harmonicSeries.imag);
        oscillator.setPeriodicWave(customWaveform);

        // Adjust gain based on frequency for consistent volume across pitches
        const volume = getVolume(frequency);

        // Amplitude envelope for plucking sound
        const now = audioCtx.currentTime;
        gainNode.gain.setValueAtTime(0, now); // Initial value
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.005); // Quick attack
        gainNode.gain.exponentialRampToValueAtTime(volume * 0.6, now + 0.03); // Immediate slight decay
        gainNode.gain.exponentialRampToValueAtTime(volume * 0.3, now + 0.1); // Further decay

        // Use setTargetAtTime for the final decay to zero
        const timeConstant = (duration - 0.1) / 5; // Adjust timeConstant as needed
        gainNode.gain.setTargetAtTime(0, now + 0.1, timeConstant); // Final decay toward zero

        // Start and stop the oscillator
        oscillator.start(now);
        oscillator.stop(now + duration + 0.5); // Stop after ensuring decay completes

        // Clean up each oscillator and gain node
        oscillator.onended = () => {
            gainNode.disconnect();
            oscillator.disconnect();
        };
    });

    // Clean up the audio context when all notes have finished playing
    setTimeout(() => {
        masterGain.disconnect();
        audioCtx.close();
    }, (duration + 0.5) * 1000);
}

// Continuous function to calculate harmonic series based on frequency
function getHarmonicSeries(frequency) {
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

// Continuous function to control volume based on frequency
function getVolume(frequency) {
    // Higher frequencies naturally sound louder; we reduce their gain
    const baseGain = 1.0;
    const volume = baseGain * Math.pow(440 / frequency, 0.3);
    return volume;
}

function pluck(...freqs) {
      playGuitarChord(freqs, 2.5); 
}

function renderSection(id, Component) {
  ReactDOM.render(<Component />, document.getElementById(id))
}

renderSection("base_tone", () => (
  <button onClick={() => pluck(200)}>α1 @ 200Hz</button>
));
