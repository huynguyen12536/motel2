import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { keyboardTravel } from "../../src/features/warehouse/3d/keyboard-travel";

function move(keys: string[], seconds = 1 / 60, plane: "3d" | "oxy" | "oxz" | "oyz" = "3d") {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);
  return keyboardTravel(camera, plane, new Set(keys), seconds, new THREE.Vector3());
}

test("forward follows the view without snapping to a world axis", () => {
  const delta = move(["w"]);
  expect(delta.x).toBeLessThan(0);
  expect(delta.z).toBeLessThan(0);
  expect(delta.y).toBe(0);
  expect(delta.length()).toBeCloseTo(0.2);
});

test("travel is independent of refresh rate and normalized diagonally", () => {
  expect(move(["w"], 1 / 30).length()).toBeCloseTo(move(["w"], 1 / 60).length() * 2);
  expect(move(["w", "d"]).length()).toBeCloseTo(move(["w"]).length());
});

test("opposite keys cancel, release stops immediately and shift boosts speed", () => {
  expect(move(["w", "s", "a", "d"]).length()).toBe(0);
  expect(move([]).length()).toBe(0);
  expect(move(["w", "shift"]).length()).toBeCloseTo(move(["w"]).length() * 2.5);
});

test("a stalled frame cannot teleport the camera", () => {
  expect(move(["w"], 5).length()).toBeCloseTo(0.6);
});

test("axis views preserve their screen-aligned movement planes", () => {
  expect(move(["w"], 1 / 60, "oxy").toArray()).toEqual([0, 0.2, 0]);
  expect(move(["d"], 1 / 60, "oyz").toArray()).toEqual([0, 0, 0.2]);
  expect(move(["w"], 1 / 60, "oxz").y).toBe(0);
});
