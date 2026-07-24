import { rename } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("dist");
await rename(
  resolve(outputDirectory, "index.html"),
  resolve(outputDirectory, "markout.html"),
);
