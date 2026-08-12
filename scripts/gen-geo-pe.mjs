// Gera src/data/geo/pe-municipios.json a partir da malha de municípios do IBGE.
// Uso: node scripts/gen-geo-pe.mjs
// Requer acesso à internet (API do IBGE) — roda só uma vez, não em runtime.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const URL_MALHA =
  "https://servicodados.ibge.gov.br/api/v3/malhas/estados/26" +
  "?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=intermediaria";
const URL_NOMES = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/26/municipios";
const OUT = "src/data/geo/pe-municipios.json";
const W = 1000; // largura do viewBox

const rings = (geom) =>
  geom.type === "Polygon"
    ? [geom.coordinates]
    : geom.type === "MultiPolygon"
      ? geom.coordinates
      : [];

function bbox(features) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of features)
    for (const poly of rings(f.geometry))
      for (const ring of poly)
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
  return { minLon, maxLon, minLat, maxLat };
}

function makeProjector({ minLon, maxLon, minLat, maxLat }) {
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const kx = Math.cos(midLat); // corrige a "largura" de 1 grau de longitude
  const spanX = (maxLon - minLon) * kx;
  const scale = W / spanX;
  const H = (maxLat - minLat) * scale;
  const project = (lon, lat) => [
    (lon - minLon) * kx * scale,
    (maxLat - lat) * scale, // y invertido (SVG cresce p/ baixo)
  ];
  return { project, H };
}

function pathOf(geometry, project) {
  const parts = [];
  for (const poly of rings(geometry))
    for (const ring of poly) {
      const pts = ring.map(([lon, lat]) => {
        const [x, y] = project(lon, lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      if (pts.length) parts.push("M" + pts.join("L") + "Z");
    }
  return parts.join("");
}

const res = await fetch(URL_MALHA);
if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);
const geo = await res.json();
let features = geo.features.filter((f) => String(f.properties.codarea) !== "2605459");

const nomesRes = await fetch(URL_NOMES);
if (!nomesRes.ok) throw new Error(`IBGE localidades respondeu ${nomesRes.status}`);
const nomes = new Map((await nomesRes.json()).map((m) => [String(m.id), m.nome]));

const box = bbox(features);
const { project, H } = makeProjector(box);

const out = features
  .map((f) => ({
    // Na malha do IBGE o código do município fica em properties.codarea.
    ibge: String(f.properties.codarea),
    nome: nomes.get(String(f.properties.codarea)) ?? "",
    d: pathOf(f.geometry, project),
  }))
  .filter((m) => m.ibge && m.d)
  .sort((a, b) => a.ibge.localeCompare(b.ibge));

mkdirSync(dirname(OUT), { recursive: true });
// viewBox como primeira linha de metadado não cabe num array; guardamos a altura
// junto de cada consumidor via o maior y. Aqui só gravamos os municípios.
writeFileSync(OUT, JSON.stringify(out));
console.log(`OK: ${out.length} municípios · viewBox 0 0 ${W} ${Math.ceil(H)} → ${OUT}`);
