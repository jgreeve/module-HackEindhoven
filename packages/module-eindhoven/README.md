# Eindhoven module

Owner: HackEindhoven maintainers; claim a task issue before changing this package.

## Working features

Open **Explore → Modules → Eindhoven → Open** for the module page, then
**Open in Sketch** to edit/run its HTML. The same document is available through
Samples. The module exposes `eindhoven_open_map` to the agent through the SDK.

- Official Wijkgrens (20 districts) and Buurtgrens (116 neighbourhoods).
- 3,103 OSM building polygons and 487 OSM green-space polygons from a **bounded
  city-centre extract** (bbox `51.435,5.468,51.447,5.490`, captured 2026-11-13).
  The extract is embedded in the sample so the Viewer does not call Overpass.
- Live Aangevraagde vergunningen, default last 90 days, with date/category/status
  filters. Latest 5,000 rows are shown, with an explicit count/cap message.
  Permit loading is still automatic on map startup; making it explicitly
  on-demand is [backlog issue #2](https://github.com/jgreeve/module-HackEindhoven/issues/2).

## Data

Municipal source: https://data.eindhoven.nl/ — datasets `wijken`, `buurten`,
`aangevraagde-vergunningen`. The catalogue lists these as public domain; they
support anonymous CORS access. The map preserves original statuses,
application/decision dates and source attribution rather than inferring that a
case was approved.

Basemap and OSM detail: © OpenStreetMap contributors (ODbL). The OSM detail is
not full-city coverage; official boundaries and permits cover the whole city.
The feature data and extraction date are recorded in each GeoJSON file. Municipal
and OSM data retain their own licenses; the package source uses the repository
MIT license.

## Extract OSM detail

The checked-in data lives in `src/data/buildings.geojson` and
`src/data/green.geojson`. Regenerate only intentionally, from the repository root:

```sh
npm run fetch:osm --workspace=@tablette/module-eindhoven
npm run fetch:osm:green --workspace=@tablette/module-eindhoven
npm run fetch:osm:buildings --workspace=@tablette/module-eindhoven
```

The script queries a bounded bbox in small green-space tiles, writes ODbL
metadata, and is not part of `npm ci`, `npm run dev`, builds or CI. Review data
size and coverage before committing a refreshed extract.

## Develop

From the repository root: `npm run dev`. In a second terminal,
`npm run watch --workspace=@tablette/module-eindhoven`, then refresh after a rebuild.
Run `npm run check`; browser integration tests use fixtures and no API keys.

`src/map.html` is the map template. `src/sample.ts` injects the checked-in OSM
data and declares the document through the project sample contract. UI, SDK
tools and tests are in this package; the app has no Eindhoven-specific import.
See [the backlog](../../docs/backlog.md) for follow-up work.
