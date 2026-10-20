# WareTwin-derived static model

Source: https://github.com/WayneChou-bot/WareTwin
Pinned commit: 81f365f323e1a097e5819ca9045637544163f219
Copyright (c) 2026 Wayne Chou — MIT license (see WARETWIN-LICENSE.txt).

`warehouse-waretwin-open.glb` is generated locally, not an original upstream GLB.
Rebuild from the FE directory: `node scripts/generate-waretwin-model.mjs`.
The vendored layout is in `scripts/vendor/waretwin/warehouse_layout.json`.
Rack/post/beam/carton geometry is adapted from `RackInstances.tsx`; static fixture
geometry is adapted from `Fixtures.tsx` at the pinned commit.

Scope: ground-floor racks and cartons, conveyors with static parcels, packing and
sorting tables, charging stations, dock pads, parking, restricted pads, walkways.
Rack and equipment names are baked into GLB geometry (no external fonts). Static
AMRs, forklift, cameras, sensors, packing arms and truck trailers are included.
No perimeter walls, ceiling, roof, mezzanine, robot simulation, AI, backend, live
telemetry, or material/postprocessing effects from WareTwin are included.
Geometry is GPU-instanced using glTF EXT_mesh_gpu_instancing.

Coordinates remain meters: 1000 mm = one scene unit. Each template is 100 x 70 m
(7,000 square meters); **this is not a measured 10 ha APA Nano floor plan**.
A/B/C are three explicitly illustrative copies of the same WareTwin template,
displayed separately. They are not three distinct real-world layouts. Upstream
zones A/B/C/D do not automatically map to APA Nano's business-zone records, so
model objects intentionally do not select unrelated existing business records.
The former `warehouse-campus-open.glb` was removed at the user's request; the
original generator remains available to regenerate it if ever needed.

The application's GLB viewer adapts the upstream Scene3D / Viewport presentation:
dark backdrop and fog, procedural RoomEnvironment lighting, ACES exposure 1.15,
36-degree perspective, rotate/pan tool modes, label toggle and optional shadows.
The floor grid texture is generated locally; there is no HDR/font CDN dependency.
FPS is measured live. Simulation-specific paths, traffic/heatmap, floor controls
and AI panels are intentionally not copied. No source branding appears in the UI.
The outer APA Nano management shell is unchanged. Attribution/license remain in
these technical files, not on the user-facing screen.
