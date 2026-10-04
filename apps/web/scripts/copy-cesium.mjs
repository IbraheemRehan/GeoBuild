import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cesiumDir = path.dirname(require.resolve("cesium"));
const cesiumBuild = path.join(cesiumDir, "Build", "Cesium");
const publicCesium = path.resolve("public", "cesium");

const dirsToCopy = ["Workers", "ThirdParty", "Assets", "Widgets"];

fs.mkdirSync(publicCesium, { recursive: true });

for (const dir of dirsToCopy) {
  const src = path.join(cesiumBuild, dir);
  const dest = path.join(publicCesium, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`Copied ${dir} to ${dest}`);
  } else {
    console.warn(`Source directory not found: ${src}`);
  }
}

console.log("Cesium assets copied successfully.");
