import React, { useState } from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0";

function playGuitarChord(frequencies, duration) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  masterGain.gain.value = 0.7; // Overall volume control

  frequencies.forEach((frequency) => {
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
    const customWaveform = audioCtx.createPeriodicWave(
      harmonicSeries.real,
      harmonicSeries.imag
    );
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
  ReactDOM.render(<Component />, document.getElementById(id));
}

renderSection("container", () => {
  const [step, setStep] = useState(1);
  
  // We want some extra margin for arrowheads:
  // The main line goes from 30 to 570.
  // But ticks are placed proportionally between x=50 and x=550.
  const arrowLineStartX = 30;
  const arrowLineEndX = 570;
  const lineStartX = 50; // where α0 will appear
  const lineEndX = 550; // where β2 will appear
  const lineY = 75;
  const circleRadius = 14;

  const ticksData = [
    { label: "α1", step: 1, freq: 200, cents: 0, color: "blue" }, // highlighted
    { label: "β1", step: 2, freq: 300, cents: 702, color: "red" },
    { label: "α2", step: 3, freq: 400, cents: 1200, color: "#ccccff" },
    { label: "γ2", step: 3, freq: 450, cents: 1404, color: "#ccffcc" },
    { label: "γ1", step: 4, freq: 225, cents: 204, color: "green" },
  ];

  const minCents = Math.min(...ticksData.map((tick) => tick.cents));
  const maxCents = Math.max(...ticksData.map((tick) => tick.cents));
  const maxStep = Math.max(...ticksData.map((tick) => tick.step));

  // Convert a "cents" value to an x-position between 50 and 550
  function toX(cents) {
    const range = maxCents - minCents;
    return lineStartX + ((cents - minCents) / range) * (lineEndX - lineStartX);
  }
  
  return (
    <>
      <svg viewBox="0 0 600 120" width="100%" height="100%">
        <defs>
          <marker
            id="arrowhead-left"
            markerWidth="10"
            markerHeight="10"
            refX="0"
            refY="5"
            orient="auto"
          >
            <polygon points="10 0, 0 5, 10 10" fill="black" />
          </marker>
          <marker
            id="arrowhead-right"
            markerWidth="10"
            markerHeight="10"
            refX="10"
            refY="5"
            orient="auto"
          >
            <polygon points="0 0, 10 5, 0 10" fill="black" />
          </marker>
        </defs>

        <line x1="10" y1="75" x2="590" y2="75" class="main-line" />

        <g id="ticks">
        {ticksData.filter(tick => tick.step <= step).map(tick => {
          const xPos = toX(tick.cents);
          const circleY = lineY - 25;
          return (
            <>
              <line className="tick-line" x1={xPos} y1={lineY - 5} x2={xPos} y2={lineY + 5} />
              <circle cx={xPos} cy={circleY} r="14" fill={tick.color} onClick={() => pluck(tick.freq)} />
              <text className="tick-label" x={xPos} y={circleY} onClick={() => pluck(tick.freq)}>{tick.label}</text> 
              <text className="cents-label" x={xPos} y={lineY + 15}>{`${tick.cents}¢`}</text>
            </>
          );
        })}
        </g>
      </svg>
      <div>
        <button onClick={() => setStep(step - 1)} disabled={step <= 1}>⬅️</button>
        {` Current step ${step} `}
        <button onClick={() => setStep(step + 1)} disabled={step >= maxStep}>➡️</button>
      </div>
    </>
  );
});
