import React from "https://esm.sh/react@18.2.0";
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

// We want some extra margin for arrowheads:
// The main line goes from 30 to 570. 
// But ticks are placed proportionally between x=50 and x=550.
const arrowLineStartX = 30;
const arrowLineEndX   = 570;
const lineStartX      = 50; // where α0 will appear
const lineEndX        = 550; // where β2 will appear
const lineY           = 75;
const circleRadius    = 14;

const ticksData = [
  { label: 'α0', freq: 100, cents: -1200 },
  { label: 'β0', freq: 150, cents: -498 },
  { label: 'α1', freq: 200, cents: 0 }, // highlighted
  { label: 'β1', freq: 300, cents: 702 },
  { label: 'α2', freq: 400, cents: 1200 },
  { label: 'β2', freq: 600, cents: 1902 },
];

const minFreq = Math.min(...ticksData.map(tick => tick.freq));
const maxFreq = Math.max(...ticksData.map(tick => tick.freq));

// Convert a "cents" value to an x-position between 50 and 550
function toX(freq) {
  const range = maxFreq - minFreq;
  return lineStartX + ( (freq - minFreq) / range ) * (lineEndX - lineStartX);
}

const ticksGroup = document.getElementById('ticks');

ticksData.forEach(tick => {
  const xPos = toX(tick.freq);

  // Draw the small vertical "tick mark" on the main line
  const tickMark = document.createElementNS("http://www.w3.org/2000/svg", "line");
  tickMark.setAttribute("x1", xPos);
  tickMark.setAttribute("y1", lineY - 5);
  tickMark.setAttribute("x2", xPos);
  tickMark.setAttribute("y2", lineY + 5);
  tickMark.setAttribute("class", "tick-line");
  ticksGroup.appendChild(tickMark);

  // Circle above the line
  const circleY = lineY - 25;  // place center ~15px above the main line
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", xPos);
  circle.setAttribute("cy", circleY);
  circle.setAttribute("r", circleRadius);
  // α1 is highlight (blue), others black
  circle.setAttribute("fill", tick.label === 'α1' ? "blue" : "black");
  ticksGroup.appendChild(circle);

  // Label inside the circle
  const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textLabel.setAttribute("x", xPos);
  textLabel.setAttribute("y", circleY);
  textLabel.setAttribute("class", "tick-label");
  textLabel.textContent = tick.label;
  textLabel.addEventListener("click", () => pluck(tick.freq));
  ticksGroup.appendChild(textLabel);

  // Cents label below the main line
  const centsText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  centsText.setAttribute("x", xPos);
  centsText.setAttribute("y", lineY + 15);
  centsText.setAttribute("class", "cents-label");
  centsText.textContent = tick.freq + "Hz";
  ticksGroup.appendChild(centsText);
});