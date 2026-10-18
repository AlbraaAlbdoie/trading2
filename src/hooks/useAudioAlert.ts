// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Audio Alert & Trade Chime Utility (Web Audio API)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import { useCallback, useRef } from "react";

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!globalAudioCtx) {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      globalAudioCtx = new AudioCtxClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === "suspended") {
    globalAudioCtx.resume();
  }
  return globalAudioCtx;
}

/** Standalone trade chime callable from anywhere in the app */
export function playTradeChime(pitch: "high" | "medium" | "low" = "high") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const freqs = {
      high: [1046.5, 1318.5, 1567.98], // C6, E6, G6 (Crystal chime)
      medium: [880, 1108.73],          // A5, C#6
      low: [587.33, 739.99],           // D5, F#5
    };

    const notes = freqs[pitch];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  } catch {
    // Audio context not allowed or unsupported
  }
}

interface UseAudioAlertReturn {
  playAlert: (type?: "bullish" | "bearish" | "info") => void;
  playChime: () => void;
  playTradeChime: (pitch?: "high" | "medium" | "low") => void;
}

export function useAudioAlert(enabled: boolean): UseAudioAlertReturn {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = getAudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number, duration: number = 0.15, gainVal: number = 0.08) => {
      if (!enabled) return;
      try {
        const ctx = getCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        vol.gain.setValueAtTime(gainVal, ctx.currentTime);
        vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        osc.connect(vol);
        vol.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch {
        // silent fail
      }
    },
    [enabled, getCtx],
  );

  const playAlert = useCallback(
    (type: "bullish" | "bearish" | "info" = "info") => {
      if (!enabled) return;
      const freqs: Record<string, number[]> = {
        bullish: [523, 659, 784, 1046], // نغمة صعودية متصاعدة
        bearish: [1046, 784, 659, 523], // نغمة هبوطية
        info: [880, 1174],              // تنبيه إشعاري
      };
      const notes = freqs[type];
      notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.12, 0.07), i * 90);
      });
    },
    [enabled, playTone],
  );

  const playChime = useCallback(() => {
    if (enabled) {
      playTradeChime("high");
    }
  }, [enabled]);

  return { playAlert, playChime, playTradeChime };
}
