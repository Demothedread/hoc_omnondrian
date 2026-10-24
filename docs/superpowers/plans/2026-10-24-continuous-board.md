<!-- DESCRIPTION: Records the implementation sequence for the continuous portfolio board. -->
<!-- INPUTS: Approved De Stijl direction, current camera and authoring backlog. -->
<!-- OUTPUTS: Bounded implementation tasks and verification requirements. -->
<!-- DEPENDENCIES: Astro, Cosmos camera, SVG, Keystatic and Project Studio. -->
# Continuous De Stijl board

Goal: remove the visible spatial edge without cloning portfolio content or adding perpetual motion.

Architecture: one SVG ground repeats in camera coordinates; miniature paintings supply a Droste depth cue. The actual HTML portfolio remains the accessible content source. Repeated named fields map to existing destinations; map navigation remains available at any pan offset.

- [x] Add independent SVG/projection/picking module and integrate with the existing camera frame.
- [x] Remove finite pan clamps while retaining zoom limits and overview navigation.
- [x] Add permanent résumé section/station IDs without changing existing routes.
- [x] Add continuous project reading to the section menu and dismiss menus before parent navigation.
- [x] Prevent session-storage quota from blocking explicit Studio saves.
- [x] Check repeat periodicity, negative coordinates, camera crossing, station reorder, existing suites and production build.
- [x] Finish browser checks and record verified behavior and remaining recommendations.

Additional runtime repair: isolate Vite dev/build optimizer caches; verify that the dev metadata hash stays unchanged across build and browser camera startup completes afterwards.
