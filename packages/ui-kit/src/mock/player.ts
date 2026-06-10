import type { ServerMessage } from "../contract.js";

export type PlayerListener = (message: ServerMessage, index: number) => void;

export interface EventPlayerOptions {
  events: ServerMessage[];
  delayMs?: number;
  onEvent?: PlayerListener;
  onComplete?: () => void;
}

export interface EventPlayer {
  play: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setSpeed: (multiplier: number) => void;
  getIndex: () => number;
  isPlaying: () => boolean;
  isPaused: () => boolean;
}

export function createEventPlayer(options: EventPlayerOptions): EventPlayer {
  const { events, delayMs = 400, onEvent, onComplete } = options;
  let index = 0;
  let playing = false;
  let paused = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let speed = 1;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const scheduleNext = (): void => {
    if (!playing || paused || index >= events.length) return;
    const current = events[index];
    if (!current) return;
    onEvent?.(current, index);
    index += 1;
    if (index >= events.length) {
      playing = false;
      onComplete?.();
      return;
    }
    timer = setTimeout(scheduleNext, Math.max(1, delayMs / speed));
  };

  return {
    play() {
      clearTimer();
      index = 0;
      playing = true;
      paused = false;
      scheduleNext();
    },
    pause() {
      if (!playing) return;
      paused = true;
      clearTimer();
    },
    resume() {
      if (!playing || !paused) return;
      paused = false;
      scheduleNext();
    },
    reset() {
      clearTimer();
      index = 0;
      playing = false;
      paused = false;
    },
    setSpeed(multiplier: number) {
      speed = Math.max(0.25, Math.min(4, multiplier));
    },
    getIndex: () => index,
    isPlaying: () => playing && !paused,
    isPaused: () => playing && paused,
  };
}
