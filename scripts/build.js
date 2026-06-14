import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildData } from "../lib/build-data.js";

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = await buildData();
  console.log(`Built ${result.problems.length} problem(s) and ${result.projects.length} project(s).`);
}
