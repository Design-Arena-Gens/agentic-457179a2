"use client";

import { ChangeEvent, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { EMOTION_PRESETS, EmotionId, EmotionPreset } from "@/lib/emotions";
import { AVATAR_PRESETS, AvatarRigId, AvatarRigPreset } from "@/lib/avatarPresets";

interface ControlPanelProps {
  text: string;
  mode: "image" | "3d";
  selectedAvatar: AvatarRigPreset;
  emotion: EmotionPreset;
  isBusy: boolean;
  isPlaying: boolean;
  hasClip: boolean;
  imageName: string;
  audioName: string;
  onTextChange: (value: string) => void;
  onModeChange: (mode: "image" | "3d") => void;
  onAvatarChange: (id: AvatarRigId) => void;
  onEmotionChange: (id: EmotionId) => void;
  onImageUpload: (file: File) => void;
  onSpeak: () => Promise<void>;
  onSelectAudio: (file: File) => Promise<void>;
  onStop: () => void;
  onReplay: () => Promise<void>;
  onExport: () => Promise<void>;
  onRegenerate: () => Promise<void>;
}

const Section = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) => (
  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 shadow-inner shadow-black/30">
    <div className="mb-4">
      <p className="text-sm font-semibold text-slate-100">{label}</p>
      {description ? (
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      ) : null}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

export const ControlPanel = ({
  text,
  mode,
  selectedAvatar,
  emotion,
  isBusy,
  isPlaying,
  hasClip,
  onTextChange,
  onModeChange,
  onAvatarChange,
  onEmotionChange,
  onImageUpload,
  onSpeak,
  onSelectAudio,
  onStop,
  onReplay,
  onExport,
  onRegenerate,
  imageName,
  audioName,
}: ControlPanelProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        onImageUpload(file);
      }
    },
    [onImageUpload],
  );

  const handleAudioChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await onSelectAudio(file);
    },
    [onSelectAudio],
  );

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto pb-6">
      <Section
        label="Avatar Source"
        description="Upload a still photo or switch to a 3D character rig."
      >
        <div className="grid grid-cols-2 gap-2">
          {(["image", "3d"] as const).map((option) => (
            <button
              key={option}
              onClick={() => onModeChange(option)}
              className={clsx(
                "group flex h-14 items-center justify-between rounded-xl border px-4 text-left transition",
                mode === option
                  ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                  : "border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5",
              )}
            >
              <span className="text-sm font-medium capitalize">{option} Avatar</span>
              <span
                className={clsx(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px]",
                  mode === option
                    ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-200"
                    : "border-white/10 text-slate-400",
                )}
              >
                {mode === option ? "✓" : "○"}
              </span>
            </button>
          ))}
        </div>
        {mode === "image" ? (
          <div className="space-y-3 rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-slate-200">
              Upload Image (PNG / JPG)
            </p>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => imageInputRef.current?.click()}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/16"
              >
                Choose Image
              </button>
              <p className="truncate text-[11px] text-slate-400">
                {imageName || "Using live capture"}
              </p>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-200">Select 3D Avatar</p>
            <div className="grid grid-cols-3 gap-2">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onAvatarChange(preset.id)}
                  className={clsx(
                    "group flex h-20 flex-col justify-between rounded-xl border p-3 text-left transition",
                    preset.id === selectedAvatar.id
                      ? "border-cyan-400/70 bg-cyan-400/10 text-cyan-100"
                      : "border-white/5 text-slate-200 hover:border-white/15 hover:bg-white/5",
                  )}
                >
                  <span className="text-sm font-semibold">{preset.label}</span>
                  <span className="flex gap-1">
                    {[preset.primary, preset.secondary, preset.accent].map((color) => (
                      <span
                        key={color}
                        className="h-2 flex-1 rounded-full"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section
        label="Speech Source"
        description="Type a script or upload voice-over to drive lip sync."
      >
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            rows={6}
            placeholder="Paste dialogue or type your script here…"
            className="w-full resize-none rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={isBusy || text.trim().length === 0}
              onClick={onSpeak}
              className={clsx(
                "rounded-xl px-4 py-2 text-xs font-semibold transition",
                isBusy || text.trim().length === 0
                  ? "cursor-not-allowed bg-white/5 text-slate-500"
                  : "bg-emerald-500/90 text-emerald-100 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400/80",
              )}
            >
              Generate Speech
            </button>
            <button
              onClick={() => audioInputRef.current?.click()}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Upload Audio
            </button>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleAudioChange}
            />
            <span className="text-[11px] text-slate-400">
              {audioName ? `Last file: ${audioName}` : "AI speech generator ready"}
            </span>
          </div>
        </div>
      </Section>

      <Section
        label="Emotion & Performance"
        description="Infuse the avatar with expressive delivery."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {EMOTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onEmotionChange(preset.id)}
                className={clsx(
                  "rounded-xl border px-3 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black active:scale-95",
                  emotion.id === preset.id
                    ? "border-white/40 bg-white/15 text-white shadow-[0_8px_24px_rgba(15,118,255,0.22)]"
                    : "border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5",
                )}
                style={
                  emotion.id === preset.id
                    ? {
                        color: preset.accentColor,
                      }
                    : undefined
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="rounded-xl border border-white/5 bg-black/30 p-3 text-xs text-slate-300">
            {emotion.description}
          </p>
        </div>
      </Section>

      <Section
        label="Playback"
        description="Preview, iterate, and export your performance."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onReplay}
            disabled={!hasClip || isBusy}
            className={clsx(
              "rounded-xl px-4 py-2 text-xs font-semibold transition",
              !hasClip || isBusy
                ? "cursor-not-allowed bg-white/5 text-slate-500"
                : "bg-sky-500/90 text-sky-50 shadow-lg shadow-sky-500/20 hover:bg-sky-400/80",
            )}
          >
            Preview
          </button>
          <button
            onClick={onStop}
            disabled={!isPlaying}
            className={clsx(
              "rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition",
              !isPlaying
                ? "cursor-not-allowed border-white/5 text-slate-500"
                : "hover:border-white/20 hover:bg-white/10",
            )}
          >
            Stop
          </button>
          <button
            onClick={onRegenerate}
            disabled={isBusy || text.trim().length === 0}
            className={clsx(
              "rounded-xl border border-emerald-400/60 px-4 py-2 text-xs font-semibold transition",
              isBusy || text.trim().length === 0
                ? "cursor-not-allowed border-white/5 text-slate-500"
                : "text-emerald-200 hover:border-emerald-400 hover:bg-emerald-400/15",
            )}
          >
            Regenerate
          </button>
          <button
            disabled={isBusy || !hasClip}
            onClick={onExport}
            className={clsx(
              "ml-auto rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition",
              isBusy || !hasClip
                ? "cursor-not-allowed bg-white/30 text-slate-500"
                : "hover:bg-slate-200",
            )}
          >
            Export MP4
          </button>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-[11px] text-slate-400">
          <span>Status</span>
          <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <span
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                isPlaying ? "bg-emerald-400 animate-ping" : "bg-slate-500",
              )}
            />
            {isPlaying ? "Live preview streaming" : isBusy ? "Processing audio…" : "Ready"}
          </span>
        </div>
      </Section>
    </aside>
  );
};
