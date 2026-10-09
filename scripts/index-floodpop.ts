/**
 * Builds data/catalog/floodpop-index.json: the bounding box, size and band count of every
 * World Bank Global Flood Exposure GeoTIFF listed in DR0089139.csv for the given countries.
 * Only TIFF headers are read (HTTP range requests); no pixel values are stored.
 *
 *   npx tsx scripts/index-floodpop.ts IND
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fromUrl } from "geotiff";

interface Entry {
  file: string;
  country: string;
  url: string;
  bbox: [number, number, number, number];
  width: number;
  height: number;
  bands: number;
  noData: number | null;
}

const OUT = "data/catalog/floodpop-index.json";

async function main() {
  const countries = new Set(process.argv.slice(2).map((code) => code.toUpperCase()));
  if (!countries.size) throw new Error("Pass at least one ISO3 country code, e.g. IND.");
  const rows = readFileSync("DR0089139.csv", "utf8").trim().split(/\r?\n/).slice(1);
  const existing: Entry[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).files : [];
  const known = new Map(existing.map((entry) => [entry.file, entry]));
  for (const row of rows) {
    const [file, url] = row.split(",");
    const country = url?.match(/GlobalFloodExposure\/([A-Z]{3})\//)?.[1];
    if (!file || !url || !country || !countries.has(country) || known.has(file)) continue;
    const image = await (await fromUrl(url)).getImage();
    const [minX, minY, maxX, maxY] = image.getBoundingBox();
    known.set(file, { file, country, url, bbox: [minX!, minY!, maxX!, maxY!], width: image.getWidth(), height: image.getHeight(), bands: image.getSamplesPerPixel(), noData: image.getGDALNoData() });
    console.log(file, [minX, minY, maxX, maxY].map((value) => value!.toFixed(3)).join(", "));
  }
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        dataset: "World Bank Global Flood Exposure: Gridded exposure headcounts by country (DR0089139)",
        licence: "CC BY 4.0",
        resolution: "3 arc-seconds (about 90 m)",
        generatedAt: new Date().toISOString(),
        files: [...known.values()].sort((a, b) => a.file.localeCompare(b.file)),
      },
      null,
      2,
    ),
  );
}

void main();
