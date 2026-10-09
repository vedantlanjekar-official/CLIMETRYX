import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// MapLibre locates its worker beside its own module, which does not exist inside bundled chunks.
const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs");
const target = join(process.cwd(), "public", "vendor", "maplibre-gl-worker.mjs");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
