import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatValidationSummary, validateProblems } from "../lib/validate-problems.js";

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const summary = await validateProblems();
  console.log(formatValidationSummary(summary));
}
