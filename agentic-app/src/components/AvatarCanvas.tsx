"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import * as THREE from "three";
import type { EmotionPreset } from "@/lib/emotions";
import type { AvatarRigPreset } from "@/lib/avatarPresets";

interface AvatarCanvasProps {
  amplitude: number;
  emotion: EmotionPreset;
  avatar: AvatarRigPreset;
  mode: "image" | "3d";
  imageTexture: string | null;
  isPlaying: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type MaterialMesh = THREE.Object3D & {
  material: {
    opacity: number;
  };
  scale: {
    x: number;
    y: number;
    z: number;
  };
};

type TextureHandle = {
  clone: () => TextureHandle;
  dispose: () => void;
  needsUpdate: boolean;
  colorSpace?: unknown;
};

const BaseLighting = () => (
  <>
    <ambientLight intensity={0.55} />
    <directionalLight
      position={[4, 8, 4]}
      intensity={1}
      castShadow
      shadow-mapSize-height={1024}
      shadow-mapSize-width={1024}
    />
    <spotLight
      position={[-6, 6, 4]}
      angle={0.5}
      penumbra={0.5}
      intensity={0.8}
      color="#38bdf8"
      castShadow
    />
    <pointLight position={[0, 3, -4]} intensity={0.2} color="#f8fafc" />
  </>
);

const Ground = () => (
  <mesh rotation-x={-Math.PI / 2} position={[0, -1.1, 0]} receiveShadow>
    <planeGeometry args={[18, 18]} />
    <meshStandardMaterial color="#020617" roughness={1} metalness={0} />
  </mesh>
);

const Hands = ({
  amplitude,
  emotion,
  preset,
  isLeft,
}: {
  amplitude: number;
  emotion: EmotionPreset;
  preset: AvatarRigPreset;
  isLeft: boolean;
}) => {
  const group = useRef<THREE.Object3D | null>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    const time = state.clock.getElapsedTime();
    const gesture = emotion.gestureIntensity;
    const targetX =
      Math.sin(time * (isLeft ? 1.4 : 1.2) + (isLeft ? 0 : Math.PI / 3)) *
        0.45 *
        gesture +
      amplitude * (isLeft ? -0.6 : 0.6);
    const targetY =
      0.2 +
      Math.cos(time * 1.1 + (isLeft ? Math.PI / 5 : 0)) * 0.25 * gesture +
      amplitude * 0.4;
    const targetZ =
      Math.sin(time * 0.8 + (isLeft ? Math.PI / 2 : 0)) * 0.25 * gesture;
    group.current.position.x = lerp(group.current.position.x, targetX, delta * 2);
    group.current.position.y = lerp(group.current.position.y, targetY, delta * 2.2);
    group.current.position.z = lerp(group.current.position.z, targetZ, delta * 2);
    group.current.rotation.z = lerp(
      group.current.rotation.z,
      isLeft ? 0.5 + amplitude * -0.6 : -0.5 + amplitude * 0.6,
      delta * 3,
    );
    group.current.rotation.x = lerp(
      group.current.rotation.x,
      Math.sin(time * 1.4) * 0.3 * gesture + amplitude * 0.3,
      delta * 3,
    );
  });

  return (
    <group ref={group} position={[isLeft ? -1.2 : 1.2, 0.2, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.17, 0.24, 1.2, 20]} />
        <meshStandardMaterial color={preset.primary} metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.65, 0.02]} castShadow>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color={preset.accent} metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  );
};

const FaceRig = ({
  amplitude,
  emotion,
  preset,
}: {
  amplitude: number;
  emotion: EmotionPreset;
  preset: AvatarRigPreset;
}) => {
  const head = useRef<THREE.Object3D | null>(null);
  const mouth = useRef<MaterialMesh | null>(null);
  const browsLeft = useRef<THREE.Object3D | null>(null);
  const browsRight = useRef<THREE.Object3D | null>(null);
  const pupilLeft = useRef<THREE.Object3D | null>(null);
  const pupilRight = useRef<THREE.Object3D | null>(null);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const expressive = emotion.gestureIntensity;
    if (head.current) {
      const targetX = Math.sin(time * 0.9) * 0.2 * expressive + amplitude * 0.4;
      const targetY =
        Math.sin(time * 0.5 + Math.PI / 2) * 0.3 * expressive +
        amplitude * 0.35;
      const targetZ = Math.sin(time * 0.8) * 0.1 * expressive;
      head.current.rotation.x = lerp(head.current.rotation.x, targetX, delta * 2);
      head.current.rotation.y = lerp(head.current.rotation.y, targetY, delta * 2.4);
      head.current.rotation.z = lerp(head.current.rotation.z, targetZ, delta * 1.8);
      head.current.position.y = lerp(
        head.current.position.y,
        2.1 + amplitude * 0.3,
        delta * 4,
      );
    }
    if (mouth.current) {
      mouth.current.scale.y = lerp(
        mouth.current.scale.y,
        0.2 + amplitude * (0.8 + emotion.mouthIntensity * 0.4),
        delta * 10,
      );
      mouth.current.scale.x = lerp(
        mouth.current.scale.x,
        1 + amplitude * 0.18,
        delta * 6,
      );
    }
    const browLift = emotion.browLift;
    const browTilt = amplitude * 0.6;
    if (browsLeft.current) {
      browsLeft.current.position.y = lerp(
        browsLeft.current.position.y,
        0.55 + browLift * 0.18 + browTilt * 0.15,
        delta * 6,
      );
      browsLeft.current.rotation.z = lerp(
        browsLeft.current.rotation.z,
        0.06 + browLift * 0.15,
        delta * 6,
      );
    }
    if (browsRight.current) {
      browsRight.current.position.y = lerp(
        browsRight.current.position.y,
        0.55 + browLift * 0.18 - browTilt * 0.15,
        delta * 6,
      );
      browsRight.current.rotation.z = lerp(
        browsRight.current.rotation.z,
        -0.06 - browLift * 0.15,
        delta * 6,
      );
    }
    const eyeShift = amplitude * 0.6 + expressive * 0.15;
    if (pupilLeft.current) {
      pupilLeft.current.position.x = lerp(
        pupilLeft.current.position.x,
        -0.2 + Math.sin(time * 1.4) * 0.08 * expressive + eyeShift * 0.08,
        delta * 5,
      );
      pupilLeft.current.position.y = lerp(
        pupilLeft.current.position.y,
        0.08 + Math.sin(time * 1.1) * 0.05 * expressive + eyeShift * 0.04,
        delta * 5,
      );
    }
    if (pupilRight.current) {
      pupilRight.current.position.x = lerp(
        pupilRight.current.position.x,
        0.2 + Math.sin(time * 1.2 + Math.PI / 4) * 0.08 * expressive + eyeShift * 0.08,
        delta * 5,
      );
      pupilRight.current.position.y = lerp(
        pupilRight.current.position.y,
        0.08 + Math.sin(time * 1.05 + Math.PI / 6) * 0.05 * expressive + eyeShift * 0.04,
        delta * 5,
      );
    }
  });

  return (
    <group ref={head} position={[0, 2.1, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.85, 42, 42]} />
        <meshStandardMaterial
          color={preset.primary}
          metalness={0.2}
          roughness={0.45}
        />
      </mesh>
      <mesh
        position={[0, -0.2, 0.75]}
        scale={[1.2, 0.45, 0.1]}
        castShadow
        ref={mouth}
      >
        <boxGeometry args={[0.6, 0.2, 0.08]} />
        <meshStandardMaterial color={preset.accent} roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[-0.35, 0.15, 0.56]} castShadow>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.2} />
      </mesh>
      <mesh position={[0.35, 0.15, 0.56]} castShadow>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.2} />
      </mesh>
      <mesh position={[-0.35, 0.15, 0.62]} ref={pupilLeft}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color="#020617" metalness={0.8} roughness={0.15} />
      </mesh>
      <mesh position={[0.35, 0.15, 0.62]} ref={pupilRight}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color="#020617" metalness={0.8} roughness={0.15} />
      </mesh>
      <mesh
        position={[-0.35, 0.52, 0.59]}
        rotation={[0, 0, 0.1]}
        ref={browsLeft}
      >
        <boxGeometry args={[0.42, 0.08, 0.06]} />
        <meshStandardMaterial color={preset.secondary} />
      </mesh>
      <mesh
        position={[0.35, 0.52, 0.59]}
        rotation={[0, 0, -0.1]}
        ref={browsRight}
      >
        <boxGeometry args={[0.42, 0.08, 0.06]} />
        <meshStandardMaterial color={preset.secondary} />
      </mesh>
    </group>
  );
};

const AvatarRig = ({
  amplitude,
  emotion,
  preset,
}: {
  amplitude: number;
  emotion: EmotionPreset;
  preset: AvatarRigPreset;
}) => {
  const torso = useRef<THREE.Object3D | null>(null);
  useFrame((state, delta) => {
    if (!torso.current) return;
    const time = state.clock.getElapsedTime();
    const wobble = Math.sin(time * 0.6) * 0.15 * emotion.gestureIntensity;
    torso.current.rotation.y = lerp(
      torso.current.rotation.y,
      wobble + amplitude * 0.35,
      delta * 3,
    );
    torso.current.rotation.x = lerp(
      torso.current.rotation.x,
      Math.sin(time * 0.7 + Math.PI / 3) * 0.08 + amplitude * 0.12,
      delta * 3,
    );
  });

  return (
    <group ref={torso} position={[0, 0, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.6, 2.2, 1]} />
        <meshStandardMaterial
          color={preset.primary}
          metalness={0.3}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[1.68, 0.8, 1.02]} />
        <meshStandardMaterial
          color={preset.secondary}
          metalness={0.4}
          roughness={0.45}
        />
      </mesh>
      <Hands amplitude={amplitude} emotion={emotion} preset={preset} isLeft />
      <Hands amplitude={amplitude} emotion={emotion} preset={preset} isLeft={false} />
      <FaceRig amplitude={amplitude} emotion={emotion} preset={preset} />
    </group>
  );
};

const FALLBACK_AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAACXBIWXMAABYlAAAWJQFJUiTwAAAIJElEQVR4nO2dS47cMBCEJSe//1OTptokqOKQPkXvJ2Z14kAW8kCKdq+OWHjC8zszLPHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABz11pvrzOt1XPX+8u31E6c+b/e9yZ3XZ9et/e8u4/d4+2cM8s+3lsPvVa3+/Ejnvru3VXZnY8z91w3nX3Pn8v3rx4w6XSevNc/tp8vK3Y3U6rW53ffIPp/rb3uZu13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mo+13m+pqPtd5vqaj7Xeb6mos81r2utdv81Y1Pbe841dY/te7zVjU9t7zjV1j+17vNWNfZt5XranN5VXu93ntRj2s5vqnN5VXu93ntRj2s5vqnN5VXu93ntRj2s5vqnN5VXu93ntRj2s5vqnN5VXu93ntRj2s5tvyXvP77u9Ouv3n3m7Lq1ZsVvP3eet/w9m3g/C4Z5P2ixe51G/a77n9X7nzs9py1Xyq1uXNV8qtblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKpW5c1Xyq1uXNV8qlblzVfKrW5s/j6v/fm738pvrS239nno38n7RaP+14nvfYyn4fG0j77aeV7fa4/7z14f97Wk1923le32uP+89eH/e1pNfdt5Xt9rj/vPXh/3taTX3beV7fa4/7z14f97Wk1923le32uP+89eH/QX6c+fOWxxizM80d7L7eNwnT/d+y+3jcJ0/3fsvt43CdP937L7eNwnT/d+y+3jcJ0/3fsvt43CdP937L7eNwnT/d+y+3jcJ0/3fsvt43CdP937L7eNwnT/d+y+3jcJ0/3fsvvnsfAAAAAACAI3L5A61wCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwN8BuJU7wE9Inh0AAAAASUVORK5CYII=";

const ImageBillboard = ({
  amplitude,
  image,
  emotion,
}: {
  amplitude: number;
  image: string | null;
  emotion: EmotionPreset;
}) => {
  const [texture, setTexture] = useState<TextureHandle | null>(null);
  const textureRef = useRef<TextureHandle | null>(null);

  useEffect(() => {
    const loaderCtor = (
      THREE as unknown as {
        TextureLoader: new (...args: unknown[]) => {
          load: (
            url: string,
            onLoad: (value: unknown) => void,
            onProgress?: unknown,
            onError?: unknown,
          ) => void;
        };
      }
    ).TextureLoader;
    const loader = new loaderCtor();
    let cancelled = false;
    loader.load(image ?? FALLBACK_AVATAR, (value) => {
      if (cancelled) return;
      const loaded = value as TextureHandle;
      if ("colorSpace" in loaded) {
        (loaded as Record<string, unknown>).colorSpace =
          (THREE as Record<string, unknown>)["SRGBColorSpace"] ??
          (THREE as Record<string, unknown>)["sRGBEncoding"];
      }
      loaded.needsUpdate = true;
      textureRef.current?.dispose();
      textureRef.current = loaded;
      setTexture(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [image]);

  useEffect(
    () => () => {
      textureRef.current?.dispose();
    },
    [],
  );

  const plane = useRef<THREE.Object3D | null>(null);
  const mouth = useRef<MaterialMesh | null>(null);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    if (plane.current) {
      plane.current.rotation.y = lerp(
        plane.current.rotation.y,
        Math.sin(time * 0.6) * 0.18 * emotion.gestureIntensity + amplitude * 0.18,
        delta * 2.4,
      );
      plane.current.rotation.x = lerp(
        plane.current.rotation.x,
        Math.sin(time * 0.8 + Math.PI / 4) * 0.08 + amplitude * 0.12,
        delta * 2.4,
      );
    }
    if (mouth.current) {
      mouth.current.scale.y = lerp(
        mouth.current.scale.y,
        0.18 + amplitude * (0.9 + emotion.mouthIntensity * 0.5),
        delta * 10,
      );
      mouth.current.scale.x = lerp(
        mouth.current.scale.x,
        1 + amplitude * 0.18,
        delta * 6,
      );
      mouth.current.material.opacity = lerp(
        mouth.current.material.opacity,
        0.25 + amplitude * 0.35,
        delta * 6,
      );
    }
  });

  return (
    <group position={[0, 1.8, 0]} ref={plane}>
      <mesh castShadow>
        <planeGeometry args={[3.1, 3.8, 1, 1]} />
        <meshStandardMaterial map={texture ?? undefined} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.7, 0.02]} ref={mouth}>
        <planeGeometry args={[1.2, 0.35, 1, 1]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.18} />
      </mesh>
      <mesh position={[0, -1.85, 0]} receiveShadow>
        <planeGeometry args={[3.6, 0.6, 1, 1]} />
        <meshStandardMaterial
          color="#020617"
          transparent
          opacity={0.4}
          blending={THREE.MultiplyBlending}
        />
      </mesh>
    </group>
  );
};

export const AvatarCanvas = ({
  amplitude,
  emotion,
  avatar,
  mode,
  imageTexture,
  isPlaying,
  onCanvasReady,
}: AvatarCanvasProps) => {
  const accentColor = emotion.accentColor ?? avatar.accent ?? "#22d3ee";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-xl">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.7, 5], fov: 42 }}
        onCreated={({ gl }) => {
          gl.setClearColor("#020617");
          if (onCanvasReady) {
            onCanvasReady(gl.domElement);
          }
        }}
      >
        <color attach="background" args={["#020617"]} />
        <fog attach="fog" args={["#020617", 12, 22]} />
        <Suspense fallback={null}>
          <BaseLighting />
          <pointLight
            position={[0, 4, 2]}
            intensity={0.8 + (isPlaying ? 0.3 : 0)}
            color={accentColor}
          />
          {mode === "3d" ? (
            <AvatarRig amplitude={amplitude} emotion={emotion} preset={avatar} />
          ) : (
            <ImageBillboard amplitude={amplitude} emotion={emotion} image={imageTexture} />
          )}
          <Ground />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={mode === "3d"}
          target={mode === "3d" ? [0, 1.2, 0] : [0, 1.8, 0]}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
      <span className="pointer-events-none absolute right-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            isPlaying ? "animate-pulse bg-emerald-400" : "bg-slate-500"
          }`}
        />
        {isPlaying ? "Streaming preview" : "Idle"}
      </span>
    </div>
  );
};
