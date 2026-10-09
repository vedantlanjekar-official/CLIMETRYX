import { fromUrl } from "geotiff";

const url = "https://datacatalogfiles.worldbank.org/ddh-published/0062763/2/DR0089139/GlobalFloodExposure/IND/FloodPop_IND_1050.tif";

async function main() {
  const [lat, lon, half] = process.argv.slice(2).map(Number) as [number, number, number];
  const image = await (await fromUrl(url)).getImage();
  const [minX, , , maxY] = image.getBoundingBox();
  const [resX, resY] = image.getResolution();
  const col = Math.floor((lon - minX!) / resX!);
  const row = Math.floor((lat - maxY!) / resY!);
  const window = [col - half, row - half, col + half + 1, row + half + 1];
  const rasters = (await image.readRasters({ window })) as unknown as ArrayLike<number>[];
  const sums = rasters.map((band) => Array.from(band).reduce((total, value) => total + value, 0));
  const nonzero = rasters.map((band) => Array.from(band).filter((value) => value !== 0).length);
  console.log({ col, row, pixels: rasters[0]!.length, sums: sums.map((value) => Math.round(value * 10) / 10), nonzero });
  const rows: number[][] = [];
  for (let index = 0; index < rasters[0]!.length; index += 1) {
    const values = rasters.map((band) => band[index]!);
    if (values.some((value) => value !== 0)) rows.push(values.map((value) => Math.round(value * 100) / 100));
  }
  console.log("sample pixels (band1..band6):");
  for (const values of rows.slice(0, 12)) console.log(values.join("\t"));
  const checks = rows.map((values) => {
    const [b1, b2, b3, b4, b5, b6] = values as [number, number, number, number, number, number];
    return { b1EqualsRest: Math.abs(b1 - (b2 + b3 + b4 + b5 + b6)) < 0.05, b6EqualsRest: Math.abs(b6 - (b1 + b2 + b3 + b4 + b5)) < 0.05, b1EqualsB2toB5: Math.abs(b1 - (b2 + b3 + b4 + b5)) < 0.05 };
  });
  const count = (key: keyof (typeof checks)[number]) => checks.filter((check) => check[key]).length;
  console.log({ withData: rows.length, b1EqualsRest: count("b1EqualsRest"), b6EqualsRest: count("b6EqualsRest"), b1EqualsB2toB5: count("b1EqualsB2toB5") });
}

void main();
