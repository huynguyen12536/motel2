"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { keyboardTravel } from "./keyboard-travel";
import {
  easeInOutCubic,
  prefersReducedMotion,
} from "@/features/warehouse/utils/warehouse.utils";

type CameraGoal = {
  position: [number, number, number];
  target: [number, number, number];
};

export type ViewPlane = "3d" | "oxy" | "oxz" | "oyz";

type OrbitApi = {
  target: THREE.Vector3;
  update: () => void;
  enableRotate: boolean;
};

const AXIS_DISTANCE = 80;
const ORTHO_HALF_HEIGHT = 22;

function alignToAxis(camera: THREE.Camera, target: THREE.Vector3, viewPlane: ViewPlane) {
  if (viewPlane === "oxz") {
    camera.position.set(target.x, target.y + AXIS_DISTANCE, target.z);
    camera.up.set(0, 0, -1);
  } else if (viewPlane === "oxy") {
    camera.position.set(target.x, target.y, target.z + AXIS_DISTANCE);
    camera.up.set(0, 1, 0);
  } else if (viewPlane === "oyz") {
    camera.position.set(target.x + AXIS_DISTANCE, target.y, target.z);
    camera.up.set(0, 1, 0);
  }
  camera.lookAt(target);
}

export function CameraController({
  goal,
  defaultGoal,
  resetToken,
  zoomToken,
  viewPlane,
  panMode = false,
}: {
  goal: CameraGoal | null;
  defaultGoal: CameraGoal;
  resetToken: number;
  zoomToken: number;
  viewPlane: ViewPlane;
  panMode?: boolean;
}) {
  const { camera, size, set } = useThree();
  const controlsRef = useRef<OrbitApi | null>(null);
  const defaultGoalRef = useRef<CameraGoal>(defaultGoal);
  const animationFrameRef = useRef<number | null>(null);
  const perspectiveRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoRef = useRef<THREE.OrthographicCamera | null>(null);
  const savedPerspective = useRef<CameraGoal | null>(null);
  const viewPlaneRef = useRef(viewPlane);
  const heldKeys = useRef(new Set<string>());
  const travel = useRef(new THREE.Vector3());
  useLayoutEffect(() => {
    viewPlaneRef.current = viewPlane;
  }, [viewPlane]);

  const cancelCameraAnimation = () => {
    if (animationFrameRef.current === null) return;
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  };

  useEffect(() => {
    defaultGoalRef.current = defaultGoal;
  }, [defaultGoal]);

  useEffect(() => {
    if (!goal) return;
    animateCamera(camera, controlsRef.current, goal, animationFrameRef);
  }, [goal, camera]);

  useEffect(() => {
    if (resetToken === 0) return;
    animateCamera(camera, controlsRef.current, defaultGoalRef.current, animationFrameRef);
  }, [resetToken, camera]);

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    if (viewPlane === "3d") {
      if (camera instanceof THREE.PerspectiveCamera) perspectiveRef.current = camera;
      const perspective = perspectiveRef.current;
      if (!perspective) return;
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
      if (camera !== perspective) set({ camera: perspective });
      return;
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      perspectiveRef.current = camera;
      const controls = controlsRef.current;
      if (controls) {
        savedPerspective.current = {
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
        };
      }
    }

    const halfH = ORTHO_HALF_HEIGHT;
    const ortho =
      orthoRef.current ??
      new THREE.OrthographicCamera(-halfH * aspect, halfH * aspect, halfH, -halfH, 0.1, 2000);
    orthoRef.current = ortho;
    ortho.left = -halfH * aspect;
    ortho.right = halfH * aspect;
    ortho.top = halfH;
    ortho.bottom = -halfH;
    ortho.near = 0.1;
    ortho.far = 2000;
    if (camera !== ortho) ortho.zoom = 1;
    ortho.updateProjectionMatrix();
    if (camera !== ortho) set({ camera: ortho });
  }, [viewPlane, camera, set, size.width, size.height]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.enableRotate = viewPlane === "3d";
    cancelCameraAnimation();
    if (viewPlane === "3d") {
      const saved = savedPerspective.current;
      if (saved && camera instanceof THREE.PerspectiveCamera) {
        if (!Number.isFinite(camera.position.x)) camera.position.set(...saved.position);
        animateCamera(camera, controls, saved, animationFrameRef);
      }
      return;
    }
    const lookY = viewPlane === "oxz" ? controls.target.y : 0;
    controls.target.set(controls.target.x, lookY, controls.target.z);
    alignToAxis(camera, controls.target, viewPlane);
  }, [viewPlane, camera]);

  useFrame((_, deltaTime) => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (heldKeys.current.size > 0) {
      keyboardTravel(camera, viewPlaneRef.current, heldKeys.current, deltaTime, travel.current);
      if (travel.current.lengthSq() > 0) {
        cancelCameraAnimation();
        camera.position.add(travel.current);
        controls.target.add(travel.current);
      }
    }
    const plane = viewPlaneRef.current;
    if (plane === "3d") return;
    alignToAxis(camera, controls.target, plane);
  }, -1);

  useEffect(() => {
    const held = heldKeys.current;
    const keys = ["w", "a", "s", "d", "shift"];
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (event.ctrlKey || event.metaKey || event.altKey || element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="listbox"]')) {
        held.clear();
        return;
      }
      const key = event.key.toLowerCase();
      if (!keys.includes(key)) return;
      if (key !== "shift") event.preventDefault();
      held.add(key);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      held.delete(event.key.toLowerCase());
    };

    const release = () => held.clear();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    window.addEventListener("focusin", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      release();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      window.removeEventListener("focusin", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, [camera, viewPlane]);

  useEffect(() => {
    if (zoomToken === 0 || !controlsRef.current) return;
    if (camera instanceof THREE.OrthographicCamera) {
      zoomOrthographicCamera(camera);
      return;
    }
    const target = controlsRef.current.target.clone();
    const direction = camera.position.clone().sub(target);
    const nextDistance = Math.max(7.5, direction.length() * 0.62);
    direction.normalize().multiplyScalar(nextDistance);
    const nextPosition = target.clone().add(direction);
    animateCamera(camera, controlsRef.current, {
      position: [nextPosition.x, nextPosition.y, nextPosition.z],
      target: [target.x, target.y, target.z],
    }, animationFrameRef);
  }, [zoomToken, camera]);

  useEffect(() => cancelCameraAnimation, []);

  return (
    <OrbitControls
      ref={controlsRef as never}
      makeDefault
      enableDamping={viewPlane === "3d"}
      dampingFactor={0.08}
      enablePan
      mouseButtons={panMode
        ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
        : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      screenSpacePanning
      panSpeed={0.9}
      rotateSpeed={0.72}
      zoomSpeed={0.9}
      minDistance={6}
      maxDistance={Math.max(48, Math.hypot(...defaultGoal.position) * 2)}
      minPolarAngle={viewPlane === "oxz" ? 0 : viewPlane === "3d" ? 0.18 : Math.PI / 2}
      maxPolarAngle={viewPlane === "oxz" ? 0 : viewPlane === "3d" ? Math.PI / 2.05 : Math.PI / 2}
      minAzimuthAngle={viewPlane === "oyz" ? Math.PI / 2 : viewPlane === "3d" ? -Infinity : 0}
      maxAzimuthAngle={viewPlane === "oyz" ? Math.PI / 2 : viewPlane === "3d" ? Infinity : 0}
      target={[0, 0, 0]}
      onStart={cancelCameraAnimation}
    />
  );
}

function zoomOrthographicCamera(camera: THREE.OrthographicCamera) {
  camera.zoom = Math.min(6, camera.zoom / 0.62);
  camera.updateProjectionMatrix();
}

function animateCamera(
  camera: THREE.Camera,
  controls: OrbitApi | null,
  goal: CameraGoal,
  animationFrameRef: React.MutableRefObject<number | null>,
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
    if (t < 1) {
      animationFrameRef.current = requestAnimationFrame(tick);
    } else {
      animationFrameRef.current = null;
    }
  };
  animationFrameRef.current = requestAnimationFrame(tick);
}
