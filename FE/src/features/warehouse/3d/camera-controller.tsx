"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  easeInOutCubic,
  prefersReducedMotion,
} from "@/features/warehouse/utils/warehouse.utils";

type CameraGoal = {
  position: [number, number, number];
  target: [number, number, number];
};

type OrbitApi = {
  target: THREE.Vector3;
  update: () => void;
};

export function CameraController({
  goal,
  resetToken,
}: {
  goal: CameraGoal | null;
  resetToken: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitApi | null>(null);
  const defaultGoal = useRef<CameraGoal>({
    position: [18, 14, 18],
    target: [0, 0, 0],
  });

  useEffect(() => {
    if (!goal) return;
    animateCamera(camera, controlsRef.current, goal);
  }, [goal, camera]);

  useEffect(() => {
    if (resetToken === 0) return;
    animateCamera(camera, controlsRef.current, defaultGoal.current);
  }, [resetToken, camera]);

  return (
    <OrbitControls
      ref={controlsRef as never}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={6}
      maxDistance={48}
      maxPolarAngle={Math.PI / 2.05}
      target={[0, 0, 0]}
    />
  );
}

function animateCamera(
  camera: THREE.Camera,
  controls: OrbitApi | null,
  goal: CameraGoal,
) {
  if (!controls) {
    camera.position.set(...goal.position);
    return;
  }

  if (prefersReducedMotion()) {
    camera.position.set(...goal.position);
    controls.target.set(...goal.target);
    controls.update();
    return;
  }

  const startPos = camera.position.clone();
  const endPos = new THREE.Vector3(...goal.position);
  const startTarget = controls.target.clone();
  const endTarget = new THREE.Vector3(...goal.target);
  const duration = 600;
  const start = performance.now();

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(startPos, endPos, e);
    controls.target.lerpVectors(startTarget, endTarget, e);
    controls.update();
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
