import template from "./map.html?raw";
import buildingsRaw from "./data/buildings.geojson?raw";
import greenRaw from "./data/green.geojson?raw";
import type { ModuleSample } from "@hackeindhoven/module-contracts";

const buildings = JSON.parse(buildingsRaw);
const green = JSON.parse(greenRaw);
const osmData = JSON.stringify({ buildings, green }).replace(/</g, "\\u003c");
const html = template.replace("__OSM_DATA__", osmData);

export const eindhovenSample: ModuleSample = {
  id: "eindhoven",
  title: "Eindhoven — open data",
  description: "Districts, neighbourhoods, OSM buildings and green spaces, with live permit applications.",
  html,
  created: "2026-11-13",
  tags: ["eindhoven", "opendata", "leaflet", "osm", "live"],
  license: "Public domain (municipal source data); ODbL (OSM data and basemap)",
  attribution: [
    "Data: Gemeente Eindhoven (public domain)",
    "Map: © OpenStreetMap contributors (ODbL)",
  ],
};
