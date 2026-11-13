# Eindhoven OSM extract

These files are checked-in OpenStreetMap snapshots for the Eindhoven city-centre
map. They are embedded into the module sample and are never fetched from
Overpass at runtime.

| File | Features | Captured | Purpose |
|---|---:|---|---|
| `buildings.geojson` | 3,103 | 2026-11-13T11:04:59Z | Building footprints |
| `green.geojson` | 487 | 2026-11-13T11:36:06Z | Parks, gardens, grass, woods and other green-space polygons |

Both use the same bounded bbox `51.435,5.468,51.447,5.490`. This is **city-centre
coverage**, not the whole municipality. Official districts, neighbourhoods and
permit applications cover the full city.

- Source: https://www.openstreetmap.org
- License: ODbL 1.0; © OpenStreetMap contributors
- Properties: `osm_id`, `osm_type`, `kind`, and the relevant building/leisure/landuse/natural tag
- Metadata: source, license, bbox, coverage, capture timestamp and extraction notes

Regenerate intentionally with the package scripts:

```sh
npm run fetch:osm:buildings --workspace=@tablette/module-eindhoven
npm run fetch:osm:green --workspace=@tablette/module-eindhoven
```

The fetch script is not run by install, dev, build or CI. Check diff size and
coverage before committing refreshed files.
