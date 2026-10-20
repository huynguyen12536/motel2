"use client";
// Adapted renderer setup; attribution is retained in public/models/warehouse/WARETWIN-LICENSE.txt.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function CampusEnvironment({ shadows }: { shadows: boolean }) {
  const gl = useThree((state) => state.gl);
  const environment = useMemo(() => {
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(room, 0.04);
    room.dispose(); generator.dispose();
    return target;
  }, [gl]);
  useEffect(() => () => environment.dispose(), [environment]);
  return <>
    <Environment map={environment.texture} environmentIntensity={0.35} />
    <color attach="background" args={["#05080f"]} />
    <fog attach="fog" args={["#05080f", 120, 260]} />
    <ambientLight intensity={0.35} color="#b9c6e0" />
    <hemisphereLight args={["#9db4e0", "#1a2233", 0.45]} />
    <directionalLight position={[-20, 60, -21]} intensity={1.6} color="#e8eefc" castShadow={shadows}
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
      shadow-camera-left={-75} shadow-camera-right={75} shadow-camera-top={75} shadow-camera-bottom={-75}
      shadow-camera-near={10} shadow-camera-far={180} />
    <pointLight position={[0, 10, 0]} intensity={0.6} color="#60a5fa" distance={80} decay={1} />
    <pointLight position={[-24, 8, -31]} intensity={1.2} color="#22c55e" distance={25} decay={1.5} />
    <pointLight position={[24, 8, -31]} intensity={1.2} color="#22d3ee" distance={25} decay={1.5} />
  </>;
}

export function CampusFrameRate({ onUpdate }: { onUpdate: (fps: number) => void }) {
  const sample = useRef({ time: 0, frames: 0 });
  useFrame((_, delta) => {
    sample.current.time += delta; sample.current.frames++;
    if (sample.current.time >= 1) {
      onUpdate(Math.round(sample.current.frames / sample.current.time));
      sample.current.time = 0; sample.current.frames = 0;
    }
  });
  return null;
}
