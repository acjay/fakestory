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

const baseFreq = 200;
const totalCents = 1200; // Total cents in an octave

function maxBy(array, calc) {
  return array
    .map((item) => [item, calc(item)])
    .toSorted((a, b) => b[1] - a[1])
    .map(([item, metric]) => item)[0];
}

function minBy(array, calc) {
  return array
    .map((item) => [item, calc(item)])
    .toSorted((a, b) => a[1] - b[1])
    .map(([item, metric]) => item)[0];
}

function nextPitch(pitch, index) {
  const perfectFifthAboveFreq = (pitch.freq * 3) / 2;
  const perfectFifthAboveCents = pitch.cents + 1200 * Math.log2(3 / 2);
  return {
    index,
    label: `${index + 1}`,
    freq:
      perfectFifthAboveFreq < baseFreq * 2
        ? perfectFifthAboveFreq
        : perfectFifthAboveFreq / 2,
    cents:
      perfectFifthAboveCents < totalCents
        ? perfectFifthAboveCents
        : perfectFifthAboveCents - 1200
  };
}

const standardDeviation = (arr, usePopulation = false) => {
  const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
  const sumOfSquaredDifferences = arr
    .reduce((acc, val) => acc.concat((val - mean) ** 2), [])
    .reduce((acc, val) => acc + val, 0);
  return Math.sqrt(
    sumOfSquaredDifferences / (arr.length - (usePopulation ? 0 : 1))
  );
};

function stats(pitches) {
  let sortedPitches = pitches.toSorted((a, b) => a.cents - b.cents);
  sortedPitches = [...sortedPitches, { cents: 1200 }];
  let smallestGap = Number.MAX_VALUE;
  let biggestGap = Number.MIN_VALUE;
  const distinctGapSizes = new Set();
  const gapSizes = [];
  for (let i = 1; i < sortedPitches.length; i++) {
    const gap = sortedPitches[i].cents - sortedPitches[i - 1].cents;
    biggestGap = gap > biggestGap ? gap : biggestGap;
    smallestGap = gap < smallestGap ? gap : smallestGap;
    distinctGapSizes.add(Math.round(gap));
    gapSizes.push(gap);
  }
  return {
    smallestGap,
    biggestGap,
    gapSizes: distinctGapSizes.size,
    biggestGapRatio: biggestGap / smallestGap,
    gapSizeStdDev: standardDeviation(gapSizes)
  };
}

function withNextPitch(pitches) {
  const next = nextPitch(maxBy(pitches, p => p.index), pitches.length);
  const newPitches = [...pitches, next];
  const newPitchStats = stats(newPitches);
  return withGapsCalculated([...pitches, { ...next, ...newPitchStats }]);
}

function withoutLastPitch(pitches) {
  const lastPitchIndex = pitches.map((pitch, i) => [pitch, i])
    .toSorted((a, b) => b[0].index - a[0].index)[0][1];
  return withGapsCalculated(pitches.toSpliced(lastPitchIndex, 1));
}


function withGapsCalculated(pitches) {
  return pitches.map((pitch) => {
    const nextCents =
      pitches
        .filter((p) => p.cents > pitch.cents)
        .toSorted((a, b) => a.cents - b.cents)[0]?.cents ?? 1200;
    const gapToNext = nextCents - pitch.cents;
    const pitchWithGaps = {
      ...pitch,
      gapToNext
    };
    return pitchWithGaps;
  }).toSorted((a, b) => a.cents - b.cents);
}

let initialPitches = [
  {
    index: 0,
    label: "1",
    freq: 200,
    cents: 0,
    smallestGap: 1200,
    biggestGap: 1200,
    gapSizes: 1,
    biggestGapRatio: 1
  }
];
for (let i = 1, lastPitch = initialPitches[0]; i < 12; i++) {
  initialPitches = withNextPitch(initialPitches);
}

renderSection("container", () => {
  const [pitches, setPitches] = useState(initialPitches);

  const totalWidth = 1200;
  const diagramWidth = 400;
  const tableSpaceWidth = totalWidth - diagramWidth;

  const radius = 150; // Radius of the outer octave circle
  const textRadius = 180; // Radius of the path for the arced labels
  const centerX = 200; // X center of the circle
  const centerY = 200; // Y center of the circle
  const offsetDistance = 30; // Distance to offset the pitch circles

  const pitchesByIndex = pitches.toSorted((a, b) => a.index - b.index);
  const tablePitchGroups = [];
  for (let i = 0; i < pitchesByIndex.length; i += 12) {
    tablePitchGroups.push(pitchesByIndex.slice(i, i + 12));
  }

  let runOfSmallGaps = 0;
  
  function onClick(event, pitch) {
    if (event.shiftKey) {
      pluck(pitch.freq * 2);
    } else if (event.ctrlKey || event.metaKey) {
      pluck(pitch.freq / 2);
    } else {
      pluck(pitch.freq);
    }
  }

  return (
    <>
      <div className="top-row">
        <div className="diagram-container">
          <svg
            id="octave-circle"
            width={diagramWidth}
            height={diagramWidth}
            viewBox={`0 0 ${diagramWidth} ${diagramWidth}`}
          >
            <circle
              cx="200"
              cy="200"
              r="150"
              stroke="black"
              stroke-width="2"
              fill="none"
            />

            <path
              id="text-path"
              d="M 200,25 A 175,175 0 1,1 199.9,25"
              fill="none"
              stroke="none"
            />

            <path
              id="outer-text-path"
              d="M 200,10 A 190,190 0 1,1 199.9,10"
              fill="none"
              stroke="none"
            />

            {pitches.map((pitch, i) => {
              // Calculate the angle for this pitch
              const arcFraction = pitch.cents / totalCents;
              const currentAngle = -90 + arcFraction * 360;

              // Calculate the position of the small circle
              const radians = (currentAngle * Math.PI) / 180;
              const x = centerX + radius * Math.cos(radians);
              const y = centerY + radius * Math.sin(radians);

              const midAngle =
                currentAngle + (pitch.gapToNext / totalCents / 2) * 360;

              // Use the mid-angle to calculate where the text should be centered on the larger circle
              const arcPosition = ((midAngle + 90) / 360) * 100; // Convert angle to percentage offset

              if (pitch.gapToNext < 30) {
                runOfSmallGaps++;
              } else {
                runOfSmallGaps = 0;
              }
              const useOuterTextPath = runOfSmallGaps >= 1 && runOfSmallGaps % 2 === 0;

              return (
                <>
                  <circle
                    className="pitch-circle"
                    cx={x}
                    cy={y}
                    r="20"
                    onClick={(e) => onClick(e, pitch)}
                  />
                  <text
                    className="label"
                    x={x}
                    y={y}
                    onClick={(e) => onClick(e, pitch)}
                  >
                    {pitch.label}
                  </text>
                  <text className="arc-label">
                    <textPath
                      href={useOuterTextPath ? "#outer-text-path" : "#text-path"}
                      startOffset={`${arcPosition}%`}
                    >
                      +{Math.round(pitch.gapToNext)}¢
                    </textPath>
                  </text>
                </>
              );
            })}
          </svg>
          <div>
            <button
              onClick={() => setPitches(withoutLastPitch(pitches))}
              disabled={pitches.length <= 1}
            >
              ➖
            </button>
            {` Scale size ${pitches.length} `}
            <button onClick={() => setPitches(withNextPitch(pitches))}>
              ➕
            </button>
          </div>
        </div>
        <div className="table-container">
          {tablePitchGroups.map((pitchGroup) => (
            <table className="scale-comparison">
              <tr>
                <th className="row-header"># of tones</th>
                {pitchGroup.map((pitch) => (
                  <th className="scale-size-header">{pitch.label}</th>
                ))}
              </tr>
              <tr>
                <th>Biggest gap</th>
                {pitchGroup.map((pitch) => (
                  <td className="table-entry">
                    {Math.round(pitch.biggestGap)}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Smallest gap</th>
                {pitchGroup.map((pitch) => (
                  <td className="table-entry">
                    {Math.round(pitch.smallestGap)}
                  </td>
                ))}
              </tr>
              <tr>
                <th># of gap sizes</th>
                {pitchGroup.map((pitch) => (
                  <td className="table-entry">{pitch.gapSizes}</td>
                ))}
              </tr>
              <tr>
                <th>Gap size std dev</th>
                {pitchGroup.map((pitch) => (
                  <td className="table-entry">
                    {pitch.gapSizeStdDev
                      ? Math.round(pitch.gapSizeStdDev)
                      : "-"}
                  </td>
                ))}
              </tr>
            </table>
          ))}
        </div>
      </div>
    </>
  );
});
const svg = document.getElementById("octave-circle");

let currentAngle = -90; // Starting from top (12 o'clock)

