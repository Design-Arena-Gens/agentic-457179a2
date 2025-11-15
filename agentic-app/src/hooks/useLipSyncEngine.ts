"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EmotionPreset } from "@/lib/emotions";

interface LipSyncClip {
  buffer: AudioBuffer;
  duration: number;
}

export interface LipSyncEngine {
  speakText: (text: string, emotion: EmotionPreset) => Promise<LipSyncClip | null>;
  playFile: (file: File, emotion: EmotionPreset) => Promise<LipSyncClip | null>;
  replay: () => Promise<void>;
  stop: () => void;
  isBusy: boolean;
  stream: MediaStream | null;
  lastClip: LipSyncClip | null;
}

const BASE_CHAR_DURATION = 0.14;
const SILENCE_PADDING = 0.28;

const VOWEL_FREQ: Record<string, number> = {
  a: 210,
  e: 230,
  i: 260,
  o: 190,
  u: 170,
  y: 240,
};

const CONSONANT_TEXTURE = 0.23;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const computeEnvelope = (index: number, total: number) => {
  const attack = Math.min(0.25, 4 / total);
  const release = attack;
  const pos = index / total;
  if (pos < attack) {
    return pos / attack;
  }
  if (pos > 1 - release) {
    return (1 - pos) / release;
  }
  return 1;
};

const synthesiseText = (
  context: AudioContext,
  text: string,
  emotion: EmotionPreset,
): LipSyncClip | null => {
  const content = text.replace(/\s+/g, " ").trim();
  if (!content) {
    return null;
  }

  const words = content.split(" ");
  const totalChars = content.length;
  const tempo = clamp(emotion.tempoMultiplier, 0.65, 1.45);
  const charDuration = BASE_CHAR_DURATION / tempo;
  const totalDuration = totalChars * charDuration + SILENCE_PADDING;
  const sampleRate = context.sampleRate ?? 44100;
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const buffer = context.createBuffer(1, totalSamples, sampleRate);
  const output = buffer.getChannelData(0);

  let cursor = 0;
  const vibratoSpeed = 6 + Math.abs(emotion.pitchShift) * 0.8;
  const vibratoDepth = 4 + Math.abs(emotion.pitchShift) * 0.4;
  const brightness = clamp(0.55 + emotion.browLift * 0.2, 0.1, 1.2);
  const consonantNoise = clamp(CONSONANT_TEXTURE + emotion.gestureIntensity * 0.15, 0.12, 0.45);

  for (const word of words) {
    for (const char of word) {
      const lower = char.toLowerCase();
      const isVowel = lower in VOWEL_FREQ;
      const baseFreq = isVowel
        ? VOWEL_FREQ[lower]
        : 140 + (lower.charCodeAt(0) % 25) * 4;

      const freq =
        baseFreq * Math.pow(2, emotion.pitchShift / 12) * (isVowel ? 1 : 0.92);
      const amplitude = clamp(
        isVowel ? 0.6 + emotion.mouthIntensity * 0.35 : 0.35 + emotion.mouthIntensity * 0.2,
        0.05,
        0.98,
      );
      const charSamples = Math.floor(charDuration * sampleRate);
      for (let i = 0; i < charSamples && cursor + i < totalSamples; i++) {
        const env = computeEnvelope(i, charSamples);
        const t = (cursor + i) / sampleRate;
        const vibrato = Math.sin(t * Math.PI * 2 * vibratoSpeed) * vibratoDepth;
        const voice =
          Math.sin(Math.PI * 2 * (freq + vibrato) * t) * amplitude * env;

        const breath =
          !isVowel
            ? (Math.random() * 2 - 1) * consonantNoise * env
            : (Math.random() * 2 - 1) * 0.02 * env;

        const brightnessTilt = isVowel
          ? Math.sin(Math.PI * 2 * freq * t * 0.5) * brightness * 0.25
          : 0;

        output[cursor + i] += clamp(voice + breath + brightnessTilt, -1, 1);
      }
      cursor += charSamples;
    }
    cursor += Math.floor(charDuration * sampleRate * 0.6);
  }

  return { buffer, duration: totalDuration };
};

const transformBufferWithEmotion = async (
  file: File,
  context: AudioContext,
  emotion: EmotionPreset,
): Promise<LipSyncClip | null> => {
  const arrayBuffer = await file.arrayBuffer();
  const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
  const pitchRatio = Math.pow(2, emotion.pitchShift / 12);
  const tempo = clamp(emotion.tempoMultiplier, 0.65, 1.45);

  const offline = new OfflineAudioContext(
    decoded.numberOfChannels,
    Math.floor(decoded.length / tempo),
    decoded.sampleRate,
  );
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.playbackRate.value = pitchRatio / tempo;
  const gain = offline.createGain();
  gain.gain.value = clamp(1 + emotion.gestureIntensity * 0.1, 0.5, 1.4);

  const colorFilter = offline.createBiquadFilter();
  colorFilter.type = emotion.browLift >= 0 ? "highshelf" : "lowshelf";
  colorFilter.frequency.value = emotion.browLift >= 0 ? 2800 : 180;
  colorFilter.gain.value = emotion.browLift * 18;

  src.connect(colorFilter).connect(gain).connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();

  return {
    buffer: rendered,
    duration: rendered.length / rendered.sampleRate,
  };
};

export const useLipSyncEngine = (
  onAmplitude: (value: number) => void,
  onEnded: () => void,
): LipSyncEngine => {
  const audioRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const lastClipRef = useRef<LipSyncClip | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastClipState, setLastClipState] = useState<LipSyncClip | null>(null);

  const ensureContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioRef.current) {
      const Ctor =
        window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        throw new Error("Web Audio API not supported in this browser.");
      }
      audioRef.current = new Ctor({ latencyHint: "interactive" });
      gainRef.current = audioRef.current.createGain();
      gainRef.current.gain.value = 0.95;
      analyserRef.current = audioRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;
      analyserRef.current.smoothingTimeConstant = 0.85;

      streamRef.current = audioRef.current.createMediaStreamDestination();
      gainRef.current
        .connect(analyserRef.current)
        .connect(audioRef.current.destination);
      gainRef.current.connect(streamRef.current);
      setStream(streamRef.current.stream);
    }
    return audioRef.current;
  }, []);

  const cancelAnalyser = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const stop = useCallback(() => {
    cancelAnalyser();
    onAmplitude(0);
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // ignore
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  }, [cancelAnalyser, onAmplitude]);

  const startAnalyserLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const tick = () => {
      analyser.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      const mapped = clamp(Math.pow(rms * 4.2, 1.2), 0, 1);
      onAmplitude(mapped);
      rafRef.current = requestAnimationFrame(tick);
    };

    cancelAnalyser();
    rafRef.current = requestAnimationFrame(tick);
  }, [cancelAnalyser, onAmplitude]);

  const playClip = useCallback(
    async (clip: LipSyncClip | null) => {
      if (!clip) return null;
      const context = ensureContext();
      if (!context || !gainRef.current) return null;

      stop();
      await context.resume();
      const source = context.createBufferSource();
      source.buffer = clip.buffer;
      sourceRef.current = source;
      source.connect(gainRef.current);
      source.start();
      startAnalyserLoop();
      lastClipRef.current = clip;
      setLastClipState(clip);

      source.onended = () => {
        cancelAnalyser();
        onAmplitude(0);
        onEnded();
      };
      return clip;
    },
    [ensureContext, stop, startAnalyserLoop, cancelAnalyser, onAmplitude, onEnded],
  );

  const speakText = useCallback(
    async (text: string, emotion: EmotionPreset) => {
      const context = ensureContext();
      if (!context) {
        return null;
      }
      setIsBusy(true);
      try {
        const clip = synthesiseText(context, text, emotion);
        await playClip(clip);
        return clip;
      } finally {
        setIsBusy(false);
      }
    },
    [ensureContext, playClip],
  );

  const playFile = useCallback(
    async (file: File, emotion: EmotionPreset) => {
      const context = ensureContext();
      if (!context) {
        return null;
      }
      setIsBusy(true);
      try {
        const clip = await transformBufferWithEmotion(file, context, emotion);
        await playClip(clip);
        return clip;
      } finally {
        setIsBusy(false);
      }
    },
    [ensureContext, playClip],
  );

  const replay = useCallback(async () => {
    if (!lastClipRef.current) return;
    await playClip(lastClipRef.current);
  }, [playClip]);

  useEffect(
    () => () => {
      stop();
      if (audioRef.current) {
        audioRef.current.close();
        audioRef.current = null;
      }
    },
    [stop],
  );

  return {
    speakText,
    playFile,
    replay,
    stop,
    isBusy,
    stream,
    lastClip: lastClipState,
  };
};
