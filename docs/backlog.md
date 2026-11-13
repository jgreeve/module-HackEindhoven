# Status and handoff

## Working foundation

- Imported the full Tablette source into `apps/tablette`, retaining its MIT notices.
- Root npm workspaces, reproducible install, module generator and CI checks.
- Eindhoven feature extracted into `packages/module-eindhoven`; its Surface is
  under Explore → Modules and its map is also available through Samples.
- Current map: official district/neighbourhood boundaries, OSM raster basemap,
  checked-in OSM building/green-space detail, live permits with
  date/category/status filtering and a visible 5,000-row cap.

## Completed: OSM buildings and green spaces

Tracked in [GitHub issue #1](https://github.com/jgreeve/module-HackEindhoven/issues/1).

- `src/data/buildings.geojson`: 3,103 polygons, 0.90 MiB, captured 2026-11-13.
- `src/data/green.geojson`: 487 polygons, 0.14 MiB, captured 2026-11-13,
  including 9 multipolygon relations.
- Coverage: city-centre bbox `51.435,5.468,51.447,5.490`, explicitly labelled in
  the map because official boundaries and permits cover the whole city.
- The data is embedded into the module sample at build time. The Viewer never
  calls Overpass; no external request is made for OSM detail.
- Independent layer toggles and scoped popups are present. ODbL source,
  timestamps and feature ids are retained in the GeoJSON metadata/properties.
- `scripts/fetch-osm.mjs` is the maintained, bounded refresh tool. It is not part
  of install/dev/build/CI. The former WIP script was replaced after the
  green-space relation conversion succeeded.

The original city-wide estimate was about 153,694 building objects, so full-city
footprints were intentionally not loaded. Extending coverage is a future task
that must consider bundle/file size and run through the same review.

## Separate task: on-demand permit requests

Tracked in [GitHub issue #2](https://github.com/jgreeve/module-HackEindhoven/issues/2).

The user requested permits be a separate request from the OSM building/green
layers. The existing map already uses separate HTTP calls, but currently loads
permits automatically when opened. Next task: make permit loading explicitly
user-triggered, independently refreshable/cancellable, and preserve filters.
Verify no permit request occurs before the user asks; test empty/error states.

## Shared maintenance

- Existing install audit reports dependency vulnerabilities; investigate through
  a dedicated compatibility-tested dependency update, not `npm audit fix --force`.
- The imported app has large-bundle/mixed-import build warnings.
- Module ownership is recorded per issue/package README. Add team-specific
  CODEOWNERS and enforce required reviews once maintainers are agreed.
