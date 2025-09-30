import { useCallback } from "preact/hooks";
import { getSoundPlayer, Note } from "../utils/sound/SoundPlayer.ts";
import { Button } from "../components/Button.tsx";

// Example melody: First few notes of "Twinkle Twinkle Little Star"
const twinkleMelody: Note[] = [
  { frequency: 261.63, duration: 500, offset: 0 }, // C4
  { frequency: 261.63, duration: 500, offset: 500 }, // C4
  { frequency: 392.00, duration: 500, offset: 1000 }, // G4
  { frequency: 392.00, duration: 500, offset: 1500 }, // G4
  { frequency: 440.00, duration: 500, offset: 2000 }, // A4
  { frequency: 440.00, duration: 500, offset: 2500 }, // A4
  { frequency: 392.00, duration: 1000, offset: 3000 }, // G4
];

export default function MusicButton() {
  const handleClick = useCallback(() => {
    const player = getSoundPlayer();
    player.playMusic(twinkleMelody);
  }, []);

  return (
    <>
      <Button onClick={handleClick}>
        Play Melody
      </Button>
    </>
  );
}
