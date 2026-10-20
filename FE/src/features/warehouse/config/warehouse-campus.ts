/** Existing campus geometry: millimeters are converted once, never rescaled twice. */
export const CAMPUS_MM_PER_UNIT = 1000;
export const CAMPUS_MODEL_URL = "/models/warehouse/warehouse-waretwin-open.glb";
export const CAMPUS_BUILDINGS = ["A", "B", "C"] as const;
export type CampusBuilding = (typeof CAMPUS_BUILDINGS)[number];
export type CampusView = CampusBuilding;
export const CAMPUS_ZONES: Record<string, string> = {
  Zone_A: "zone-a", Zone_B: "zone-b", Zone_C: "zone-c", Zone_Q: "zone-q",
};
export const campusMillimetersToUnits = (value: number) => value / CAMPUS_MM_PER_UNIT;
