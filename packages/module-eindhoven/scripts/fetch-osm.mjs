// SPDX-FileCopyrightText: 2026 Milovann Yanatchkov
// SPDX-License-Identifier: MIT

// Build the bounded, prefetched OSM data used by the Eindhoven sample.
// Coverage is the city-centre bbox below. The Viewer never queries Overpass.
// Usage:
//   node scripts/fetch-osm.mjs --buildings
//   node scripts/fetch-osm.mjs --green
//   node scripts/fetch-osm.mjs

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "src", "data");
const BBOX = [51.435, 5.468, 51.447, 5.49];
const GREEN_TILES = 3;
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const USER_AGENT = "tablette-hackeindhoven/0.1";
const args = new Set(process.argv.slice(2));
const fetchBuildings = args.size === 0 || args.has("--buildings");
const fetchGreen = args.size === 0 || args.has("--green");

const GREEN_FILTERS = [
  `way["leisure"~"^(park|garden|nature_reserve|playground|pitch|golf_course|common)$"]`,
  `relation["leisure"~"^(park|garden|nature_reserve|playground|pitch|golf_course|common)$"]`,
  `way["landuse"~"^(grass|forest|meadow|recreation_ground|village_green|cemetery|orchard|vineyard|allotments)$"]`,
  `relation["landuse"~"^(grass|forest|meadow|recreation_ground|village_green|cemetery|orchard|vineyard|allotments)$"]`,
  `way["natural"~"^(wood|scrub|heath|grassland|wetland)$"]`,
  `relation["natural"~"^(wood|scrub|heath|grassland|wetland)$"]`,
];
const GREEN_WAY_FILTERS = GREEN_FILTERS.filter((filter) => filter.startsWith("way"));
const GREEN_RELATION_FILTERS = GREEN_FILTERS.filter((filter) => filter.startsWith("relation"));

function bboxClause(bounds) {
  return bounds.map((value) => value.toFixed(6)).join(",");
}

function grid(bounds) {
  const [south, west, north, east] = bounds;
  const latStep = (north - south) / GREEN_TILES;
  const lonStep = (east - west) / GREEN_TILES;
  const tiles = [];
  for (let row = 0; row < GREEN_TILES; row++) {
    for (let column = 0; column < GREEN_TILES; column++) {
      tiles.push([
        south + row * latStep,
        west + column * lonStep,
        south + (row + 1) * latStep,
        west + (column + 1) * lonStep,
      ]);
    }
  }
  return tiles;
}

function query(filters, bounds) {
  const box = bboxClause(bounds);
  return `[out:json][timeout:120];
(
${filters.map((filter) => `  ${filter}(${box});`).join("\n")}
);
out geom;`;
}

function buildingQuery() {
  return query([`way["building"]`, `relation["building"]`], BBOX);
}

function greenWaysQuery(bounds) {
  return query(GREEN_WAY_FILTERS, bounds);
}

function greenRelationsQuery() {
  return query(GREEN_RELATION_FILTERS, BBOX);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOverpass(body, label) {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({ data: body }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await response.text();
      if (!text.trimStart().startsWith("{")) throw new Error(text.slice(0, 160));
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      const wait = Math.min(24_000, 3_000 * 2 ** attempt);
      console.warn(`  ${label}: ${endpoint} -> ${error instanceof Error ? error.message : error}; retrying in ${wait}ms`);
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : lastError}`);
}

function roundCoord(point) {
  return [Number(point.lon.toFixed(6)), Number(point.lat.toFixed(6))];
}

function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function isClosed(ring) {
  return ring.length > 1 && samePoint(ring[0], ring[ring.length - 1]);
}

function sqSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points;
  const squaredTolerance = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  markers[0] = 1;
  markers[points.length - 1] = 1;
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDistance = squaredTolerance;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = sqSegmentDistance(points[i], points[start], points[end]);
      if (distance > maxDistance) {
        index = i;
        maxDistance = distance;
      }
    }
    if (index !== -1) {
      markers[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, index) => markers[index]);
}

function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return ring;
  const simplified = simplifyLine(ring.slice(0, -1), tolerance);
  simplified.push(simplified[0]);
  return simplified.length >= 4 ? simplified : ring;
}

function cleanedPath(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 2) return null;
  const path = [];
  for (const point of geometry) {
    const next = roundCoord(point);
    if (!path.length || !samePoint(path[path.length - 1], next)) path.push(next);
  }
  return path.length >= 2 ? path : null;
}

function ringFromGeometry(geometry, tolerance) {
  if (!Array.isArray(geometry) || geometry.length < 3) return null;
  const ring = cleanedPath(geometry);
  if (!ring) return null;
  if (!isClosed(ring)) ring.push(ring[0]);
  if (ring.length < 4) return null;
  return simplifyRing(ring, tolerance);
}

function stitchRings(lines) {
  const remaining = lines.map((line) => line.slice());
  const rings = [];
  while (remaining.length) {
    let ring = remaining.shift();
    let extended = true;
    while (!isClosed(ring) && extended) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const line = remaining[i];
        if (samePoint(ring[ring.length - 1], line[0])) {
          ring = ring.concat(line.slice(1));
        } else if (samePoint(ring[ring.length - 1], line[line.length - 1])) {
          ring = ring.concat(line.slice(0, -1).reverse());
        } else {
          continue;
        }
        remaining.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (isClosed(ring) && ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const intersects =
      ring[i][1] > point[1] !== ring[j][1] > point[1] &&
      point[0] <
        ((ring[j][0] - ring[i][0]) * (point[1] - ring[i][1])) /
          (ring[j][1] - ring[i][1] || Number.EPSILON) +
          ring[i][0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function geometryForElement(element, tolerance) {
  if (element.type === "way") {
    const ring = ringFromGeometry(element.geometry, tolerance);
    return ring ? { type: "Polygon", coordinates: [ring] } : null;
  }
  if (element.type !== "relation" || !Array.isArray(element.members)) return null;
  const outers = [];
  const inners = [];
  for (const member of element.members) {
    const path = cleanedPath(member.geometry);
    if (!path) continue;
    if (member.role === "inner") inners.push(path);
    else if (member.role === "outer" || !member.role) outers.push(path);
  }
  const stitchedOuters = stitchRings(outers).map((ring) => simplifyRing(ring, tolerance));
  if (!stitchedOuters.length) return null;
  const stitchedInners = stitchRings(inners).map((ring) => simplifyRing(ring, tolerance));
  return {
    type: "MultiPolygon",
    coordinates: stitchedOuters.map((outer) => [outer, ...stitchedInners.filter((inner) => pointInRing(inner[0], outer))]),
  };
}

function propertiesForElement(element, kind) {
  const tags = element.tags || {};
  const properties = {
    osm_id: element.id,
    osm_type: element.type,
    kind,
    name: tags.name,
    building: tags.building,
    leisure: tags.leisure,
    landuse: tags.landuse,
    natural: tags.natural,
  };
  for (const key of Object.keys(properties)) {
    if (properties[key] === undefined) delete properties[key];
  }
  return properties;
}

function featureForElement(element, kind, tolerance) {
  const geometry = geometryForElement(element, tolerance);
  return geometry ? { type: "Feature", properties: propertiesForElement(element, kind), geometry } : null;
}

function collection(features, name, notes) {
  return {
    type: "FeatureCollection",
    name,
    generated: new Date().toISOString(),
    source: "https://www.openstreetmap.org",
    license: "ODbL 1.0",
    bbox: [BBOX[1], BBOX[0], BBOX[3], BBOX[2]],
    coverage: `Eindhoven city-centre bbox ${bboxClause(BBOX)}`,
    notes,
    features,
  };
}

function writeCollection(file, data) {
  mkdirSync(outputDir, { recursive: true });
  const target = join(outputDir, file);
  const text = JSON.stringify(data);
  writeFileSync(target, text);
  console.log(`  ${file}: ${data.features.length} features, ${(Buffer.byteLength(text) / 1024 / 1024).toFixed(2)} MiB`);
}

async function collectBuildings() {
  console.log("Fetching OSM buildings for the full extract bbox...");
  const data = await fetchOverpass(buildingQuery(), "buildings");
  const features = new Map();
  for (const element of data.elements || []) {
    const feature = featureForElement(element, "building", 0.00001);
    if (feature) features.set(`${element.type}/${element.id}`, feature);
  }
  writeCollection(
    "buildings.geojson",
    collection([...features.values()], "OpenStreetMap buildings — Eindhoven city centre", "Bounded city-centre extract; OSM ways and relations with valid polygon geometry."),
  );
}

async function collectGreen() {
  console.log("Fetching OSM green-space ways in tiles...");
  const features = new Map();
  const tiles = grid(BBOX);
  let pending = tiles.map((tile, index) => ({ tile, index }));

  for (let pass = 0; pass < 2 && pending.length; pass++) {
    const failed = [];
    for (const item of pending) {
      console.log(`  green ways ${item.index + 1}/${tiles.length} (pass ${pass + 1}): ${bboxClause(item.tile)}`);
      try {
        const data = await fetchOverpass(
          greenWaysQuery(item.tile),
          `green ways ${item.index + 1}`,
          pass === 0 ? 3 : 5,
        );
        for (const element of data.elements || []) {
          const feature = featureForElement(element, "green", 0.00003);
          if (feature) features.set(`${element.type}/${element.id}`, feature);
        }
      } catch (error) {
        console.warn(`  tile ${item.index + 1} unavailable: ${error instanceof Error ? error.message : error}`);
        failed.push(item);
      }
      await sleep(400);
    }
    pending = failed;
  }

  let relationNote = "Green-space ways only; no multipolygon relations were returned.";
  try {
    console.log("Fetching OSM green-space relation polygons...");
    const data = await fetchOverpass(greenRelationsQuery(), "green relations", 3);
    let relationCount = 0;
    for (const element of data.elements || []) {
      const feature = featureForElement(element, "green", 0.00003);
      if (feature) {
        features.set(`${element.type}/${element.id}`, feature);
        relationCount++;
      }
    }
    relationNote = `Green-space ways and ${relationCount} multipolygon relation(s).`;
  } catch (error) {
    console.warn(`  relation polygons unavailable; keeping ways only. ${error instanceof Error ? error.message : error}`);
  }

  if (pending.length) {
    relationNote += ` Partial extract: ${pending.length}/${tiles.length} way tiles unavailable; rerun --green to fill.`;
    console.warn(`  ${pending.length}/${tiles.length} green tiles are missing.`);
    process.exitCode = 1;
  }

  writeCollection(
    "green.geojson",
    collection([...features.values()], "OpenStreetMap green spaces — Eindhoven city centre", `Bounded city-centre extract. ${relationNote}`),
  );
}

async function main() {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  if (fetchBuildings) await collectBuildings();
  if (fetchGreen) await collectGreen();
  console.log("OSM extract complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
