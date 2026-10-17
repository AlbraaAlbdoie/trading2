// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Audio Alert Hook (Web Audio API)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import { useCallback, useRef } from "react";

interface UseAudioAlertReturn {
  playAlert: (type?: "bullish" | "bearish" | "info") => void;
  playChime: () => void;
}

export function useAudioAlert(enabled: boolean): UseAudioAlertReturn {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  /** Play a frequency tone with optional duration */
  const playTone = useCallback(
    (frequency: number, duration: number = 0.15, gain: number = 0.1) => {
      if (!enabled) return;
      try {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        vol.gain.setValueAtTime(gain, ctx.currentTime);
        vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(vol);
        vol.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch {
        // Web Audio API not available — silent fail
      }
    },
    [enabled, getCtx],
  );

  /** Alert chime — ascending or descending pattern */
  const playAlert = useCallback(
    (type: "bullish" | "bearish" | "info" = "info") => {
      if (!enabled) return;
      const freqs: Record<string, number[]> = {
        bullish: [523, 659, 784],    // C5 → E5 → G5 ascending
        bearish: [784, 659, 523],    // G5 → E5 → C5 descending
        info: [880, 880],            // A5 double beep
      };
      const notes = freqs[type];
      notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.12, 0.08), i * 130);
      });
    },
    [enabled, playTone],
  );

  /** Simple chime for price updates */
  const playChime = useCallback(() => {
    playTone(1047, 0.08, 0.04); // C6 short blip
  }, [playTone]);

  return { playAlert, playChime };
}
