// utils/WaveState.ts
interface WaveState {
  amplitude: number; // Current amplitude (0-1)
  frequency: number; // Frequency in Hz
  isPlaying: boolean; // Whether a sound is currently playing
  startTime: number; // When the current sound started playing
  waveHistory: Point[]; // Store history of wave points
}

interface Point {
  x: number;
  y: number;
  time: number;
  amplitude: number;
  waveStart: number; // Start time of the wave this point belongs to
}

// islands/WaveDemo.tsx
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { getSoundPlayer } from "../utils/sound/SoundPlayer.ts";

const VISUAL_SCALING = 100; // Scale down frequency by 100x for visualization
const DECAY_TIME = 3000; // 3 second decay
const HISTORY_TIME = 1000; // Show 1 second of history
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 300;
const BALL_RADIUS = 8;
const WAVE_SEGMENTS = 200; // Number of segments to draw the wave
const ATTACK_TIME = 50; // Time in ms for initial amplitude ramp

export default function WaveDemo() {
  const [frequency, setFrequency] = useState(400);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastDrawTimeRef = useRef<number>(performance.now());

  // Create refs for our three canvas layers
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const waveStateRef = useRef<WaveState>({
    amplitude: 0,
    frequency,
    isPlaying: false,
    startTime: 0,
    waveHistory: [],
  });

  // Initialize our canvas layers
  useEffect(() => {
    bgCanvasRef.current = document.createElement("canvas");
    bgCanvasRef.current.width = CANVAS_WIDTH;
    bgCanvasRef.current.height = CANVAS_HEIGHT;

    waveCanvasRef.current = document.createElement("canvas");
    waveCanvasRef.current.width = CANVAS_WIDTH;
    waveCanvasRef.current.height = CANVAS_HEIGHT;

    ballCanvasRef.current = document.createElement("canvas");
    ballCanvasRef.current.width = CANVAS_WIDTH;
    ballCanvasRef.current.height = CANVAS_HEIGHT;

    lastDrawTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(drawWave);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      bgCanvasRef.current = null;
      waveCanvasRef.current = null;
      ballCanvasRef.current = null;
    };
  }, []);

  const startWave = useCallback(() => {
    const player = getSoundPlayer();
    const startTime = performance.now();

    player.playPureTone(frequency, DECAY_TIME);

    // Update the wave state but preserve history
    waveStateRef.current = {
      ...waveStateRef.current,
      amplitude: 1,
      frequency,
      isPlaying: true,
      startTime,
      // Keep existing history points
      waveHistory: waveStateRef.current.waveHistory,
    };
  }, [frequency]);

  // Calculate wave displacement at any point in time
  const calculateDisplacement = useCallback(
    (time: number, amplitude: number, waveStartTime: number) => {
      const scaledFreq = waveStateRef.current.frequency / VISUAL_SCALING;
      const baseDisplacement = Math.sin(2 * Math.PI * scaledFreq * time / 1000);

      // Apply attack envelope during the initial period
      if (time - waveStartTime < ATTACK_TIME) {
        const attackPhase = (time - waveStartTime) / ATTACK_TIME;
        amplitude *= attackPhase;
      }

      return baseDisplacement * amplitude;
    },
    [],
  );

  const drawWave = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const waveCanvas = waveCanvasRef.current;
    const ballCanvas = ballCanvasRef.current;

    if (!canvas || !waveCanvas || !ballCanvas) return;

    const ctx = canvas.getContext("2d");
    const waveCtx = waveCanvas.getContext("2d");
    const ballCtx = ballCanvas.getContext("2d");

    if (!ctx || !waveCtx || !ballCtx) return;

    const currentTime = performance.now();
    const waveState = waveStateRef.current;

    // Clear canvases
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    waveCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ballCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Calculate current amplitude
    let currentAmplitude = 0;
    if (waveState.isPlaying) {
      const timeSinceStart = currentTime - waveState.startTime;
      currentAmplitude = Math.max(0, 1 - (timeSinceStart / DECAY_TIME));

      if (currentAmplitude <= 0) {
        waveState.isPlaying = false;
      }
    }

    // Calculate ball position (90% from left)
    const ballX = CANVAS_WIDTH * 0.9;
    const ballY = (CANVAS_HEIGHT / 2) +
      (calculateDisplacement(
        currentTime,
        currentAmplitude,
        waveState.startTime,
      ) * CANVAS_HEIGHT / 4);

    // Add new point to history
    waveState.waveHistory.push({
      x: ballX,
      y: ballY,
      time: currentTime,
      amplitude: currentAmplitude,
      waveStart: waveState.startTime,
    });

    // Remove points that are too old
    const cutoffTime = currentTime - HISTORY_TIME;
    waveState.waveHistory = waveState.waveHistory.filter((point) =>
      point.time > cutoffTime
    );

    // Draw the wave path
    waveCtx.beginPath();
    waveCtx.strokeStyle = "rgba(0, 200, 0, 0.8)";
    waveCtx.lineWidth = 2;

    // Draw through all history points, adjusting x positions for scrolling
    waveState.waveHistory.forEach((point, index) => {
      const timeDelta = currentTime - point.time;
      const x = ballX - (timeDelta * (ballX / HISTORY_TIME));

      if (index === 0) {
        waveCtx.moveTo(x, point.y);
      } else {
        waveCtx.lineTo(x, point.y);
      }
    });

    waveCtx.stroke();

    // Draw ball
    ballCtx.beginPath();
    ballCtx.fillStyle = "rgb(0, 200, 0)";
    ballCtx.arc(ballX, ballY, BALL_RADIUS, 0, 2 * Math.PI);
    ballCtx.fill();

    // Draw ball glow
    const gradient = ballCtx.createRadialGradient(
      ballX,
      ballY,
      0,
      ballX,
      ballY,
      BALL_RADIUS * 2,
    );
    gradient.addColorStop(0, "rgba(0, 255, 0, 0.3)");
    gradient.addColorStop(0.5, "rgba(0, 255, 0, 0.1)");
    gradient.addColorStop(1, "rgba(0, 255, 0, 0)");

    ballCtx.beginPath();
    ballCtx.fillStyle = gradient;
    ballCtx.arc(ballX, ballY, BALL_RADIUS * 2, 0, 2 * Math.PI);
    ballCtx.fill();

    // Compose final image
    ctx.drawImage(waveCanvas, 0, 0);
    ctx.drawImage(ballCanvas, 0, 0);

    // Continue animation
    animationRef.current = requestAnimationFrame(drawWave);
    lastDrawTimeRef.current = currentTime;
  }, [calculateDisplacement]);

  // Handle frequency changes
  useEffect(() => {
    waveStateRef.current.frequency = frequency;
  }, [frequency]);

  return (
    <div class="flex flex-col items-center gap-4 p-4">
      <div class="flex gap-4 items-center">
        <input
          type="range"
          min="400"
          max="800"
          value={frequency}
          onInput={(e) => setFrequency(Number(e.currentTarget.value))}
          class="w-48"
        />
        <span class="text-lg">{frequency} Hz</span>
        <button
          onClick={startWave}
          class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          disabled={waveStateRef.current.isPlaying}
        >
          Play Tone
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        class="border border-gray-300 rounded"
      />
    </div>
  );
}
