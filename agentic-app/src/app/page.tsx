"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import { ControlPanel } from "@/components/ControlPanel";
import { AVATAR_PRESETS, AvatarRigId } from "@/lib/avatarPresets";
import {
  EmotionId,
  EmotionPreset,
  getEmotionPreset,
} from "@/lib/emotions";
import { useLipSyncEngine } from "@/hooks/useLipSyncEngine";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const createVariantEmotion = (preset: EmotionPreset): EmotionPreset => {
  const jitter = () => 0.92 + Math.random() * 0.16;
  const tempo = clamp(preset.tempoMultiplier * jitter(), 0.65, 1.45);
  const pitch = clamp(preset.pitchShift + (Math.random() - 0.5) * 1.6, -6, 6);
  const gesture = clamp(preset.gestureIntensity * jitter(), 0.35, 1.4);
  const mouth = clamp(preset.mouthIntensity * jitter(), 0.4, 1.4);
  const brow = clamp(preset.browLift + (Math.random() - 0.5) * 0.4, -0.6, 1.2);
  return {
    ...preset,
    tempoMultiplier: tempo,
    pitchShift: pitch,
    gestureIntensity: gesture,
    mouthIntensity: mouth,
    browLift: brow,
  };
};

const DEFAULT_SCRIPT =
  "Hey there! This is your new AI-driven avatar speaking with lip-sync, gestures, and expressive motion. Upload a voice-over or type any script to bring me to life.";

export default function StudioPage() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [mode, setMode] = useState<"image" | "3d">("3d");
  const [avatarId, setAvatarId] = useState<AvatarRigId>("nova");
  const [emotionId, setEmotionId] = useState<EmotionId>("neutral");
  const [amplitude, setAmplitude] = useState(0);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [audioName, setAudioName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const selectedAvatar = useMemo(
    () => AVATAR_PRESETS.find((item) => item.id === avatarId) ?? AVATAR_PRESETS[0],
    [avatarId],
  );
  const emotion = useMemo(() => getEmotionPreset(emotionId), [emotionId]);

  const handleAmplitude = useCallback((value: number) => {
    setAmplitude((prev) => prev * 0.68 + value * 0.32);
  }, []);

  const handlePlaybackEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const { speakText, playFile, replay, stop, stream, isBusy, lastClip } =
    useLipSyncEngine(handleAmplitude, handlePlaybackEnded);

  const ensureFfmpeg = useCallback(async () => {
    if (ffmpegRef.current) {
      return ffmpegRef.current;
    }
    const instance = new FFmpeg();
    instance.on("log", ({ message }) => {
      setExportStatus(message);
    });
    instance.on("progress", ({ progress }) => {
      setExportStatus(`Encoding ${Math.round(progress * 100)}%`);
    });
    setExportStatus("Loading encoder…");
    await instance.load();
    ffmpegRef.current = instance;
    return instance;
  }, []);

  const handleSpeak = useCallback(async () => {
    if (!script.trim()) return;
    setIsPlaying(true);
    const variant = createVariantEmotion(emotion);
    const clip = await speakText(script, variant);
    if (!clip) {
      setIsPlaying(false);
    }
  }, [script, emotion, speakText]);

  const handleRegenerate = useCallback(async () => {
    if (!script.trim()) return;
    setIsPlaying(true);
    const variant = createVariantEmotion(emotion);
    const clip = await speakText(script, variant);
    if (!clip) {
      setIsPlaying(false);
    }
  }, [emotion, script, speakText]);

  const handleAudioSelection = useCallback(
    async (file: File) => {
      setAudioName(file.name);
      setIsPlaying(true);
      const clip = await playFile(file, emotion);
      if (!clip) {
        setIsPlaying(false);
      }
    },
    [emotion, playFile],
  );

  const handleStop = useCallback(() => {
    stop();
    setIsPlaying(false);
    setAmplitude(0);
  }, [stop]);

  const handleReplay = useCallback(async () => {
    if (!lastClip) return;
    setIsPlaying(true);
    await replay();
  }, [lastClip, replay]);

  const handleImageUpload = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleExport = useCallback(async () => {
    if (!lastClip || !stream || !canvasRef.current) {
      setExportStatus("Generate or load audio before exporting.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setExportStatus("MediaRecorder is not supported in this browser.");
      return;
    }
    setIsExporting(true);
    setExportStatus("Starting capture…");

    const canvas = canvasRef.current;
    const canvasStream = canvas.captureStream(30);
    const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...stream.getAudioTracks(),
    ];
    const combinedStream = new MediaStream(combinedTracks);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(combinedStream, {
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: 6_000_000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const recordingPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
    });

    recorder.start();
    setIsPlaying(true);
    await replay();

    const recordDuration = Math.max(0.5, lastClip.duration) * 1000 + 400;
    setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, recordDuration);

    const webmBlob = await recordingPromise;
    const ffmpeg = await ensureFfmpeg();

    await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob));
    setExportStatus("Encoding stream…");
    await ffmpeg.exec([
      "-i",
      "input.webm",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
    const data = (await ffmpeg.readFile("output.mp4")) as unknown;
    let videoBytes: Uint8Array;
    if (data instanceof Uint8Array) {
      videoBytes = data;
    } else if (typeof data === "string") {
      videoBytes = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      videoBytes = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data as ArrayBufferView)) {
      videoBytes = new Uint8Array(
        (data as ArrayBufferView).buffer.slice(
          (data as ArrayBufferView).byteOffset,
          (data as ArrayBufferView).byteOffset + (data as ArrayBufferView).byteLength,
        ),
      );
    } else {
      videoBytes = new Uint8Array();
    }
    const videoBuffer = videoBytes.buffer.slice(
      videoBytes.byteOffset,
      videoBytes.byteOffset + videoBytes.byteLength,
    ) as ArrayBuffer;
    const mp4Blob = new Blob([videoBuffer], { type: "video/mp4" });
    const url = URL.createObjectURL(mp4Blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lip-sync-avatar-${Date.now()}.mp4`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setExportStatus("Export complete!");
    setIsExporting(false);
    await ffmpeg.deleteFile("input.webm");
    await ffmpeg.deleteFile("output.mp4");
  }, [ensureFfmpeg, lastClip, replay, stream]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-slate-950/60 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-lg font-semibold text-emerald-300">
            AI
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-100">
              Agentic Lip-Sync Studio
            </h1>
            <p className="text-xs text-slate-400">
              Real-time expressive avatars with AI speech and gesture control.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            Emotion · {emotion.label}
          </span>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            Ready to render
          </span>
        </div>
      </header>

      <main className="grid flex-1 gap-6 px-6 py-6 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <ControlPanel
          text={script}
          mode={mode}
          selectedAvatar={selectedAvatar}
          emotion={emotion}
          isBusy={isBusy || isExporting}
          isPlaying={isPlaying}
          hasClip={Boolean(lastClip)}
          onTextChange={setScript}
          onModeChange={setMode}
          onAvatarChange={setAvatarId}
          onEmotionChange={setEmotionId}
          onImageUpload={handleImageUpload}
          onSpeak={handleSpeak}
          onSelectAudio={handleAudioSelection}
          onStop={handleStop}
          onReplay={handleReplay}
          onExport={handleExport}
          onRegenerate={handleRegenerate}
          imageName={imageName}
          audioName={audioName}
        />

        <section className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Live Preview</h2>
              <p className="text-xs text-slate-400">
                Lip sync, facial expressions, and gestures update in real time.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex h-2.5 w-2.5 items-center justify-center">
                <span
                  className={`block h-2 w-2 rounded-full ${
                    isPlaying ? "animate-pulse bg-emerald-400" : "bg-slate-500"
                  }`}
                />
              </span>
              {isPlaying ? "Streaming" : isBusy ? "Processing" : "Idle"}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/5 bg-black/40 p-4 shadow-[0_30px_60px_-30px_rgba(14,165,233,0.25)] backdrop-blur transition-all duration-300">
            <div className="grid flex-1 grid-rows-1">
              <AvatarCanvas
                amplitude={amplitude}
                emotion={emotion}
                avatar={selectedAvatar}
                mode={mode}
                imageTexture={imageData}
                isPlaying={isPlaying}
                onCanvasReady={handleCanvasReady}
              />
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Amplitude</span>
                <span>{(amplitude * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-blue-500 transition-all"
                  style={{ width: `${clamp(amplitude * 100, 6, 100)}%` }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span>
                  {isExporting
                    ? exportStatus || "Encoding…"
                    : isBusy
                    ? "Processing audio…"
                    : lastClip
                    ? `Clip length: ${lastClip.duration.toFixed(2)}s`
                    : "Waiting for input"}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
