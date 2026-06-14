import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PROBLEMS_DIR = path.join(ROOT_DIR, "problems");
const CACHE_DIR = path.join(ROOT_DIR, ".cache");
const VALIDATION_RESULTS_PATH = path.join(CACHE_DIR, "validation-results.json");

const REQUIRED_FILES = ["problem.json", "solution.js", "tests.json", "explanation.md"];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectProblemDirectories(rootDir) {
  const directories = [];
  const platformEntries = await readdir(rootDir, { withFileTypes: true }).catch(() => []);

  for (const platformEntry of platformEntries) {
    if (!platformEntry.isDirectory()) {
      continue;
    }

    const platformDir = path.join(rootDir, platformEntry.name);
    const problemEntries = await readdir(platformDir, { withFileTypes: true }).catch(() => []);

    for (const problemEntry of problemEntries) {
      if (!problemEntry.isDirectory()) {
        continue;
      }

      directories.push(path.join(platformDir, problemEntry.name));
    }
  }

  return directories;
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function getCompleteProblemDirectories() {
  const directories = await collectProblemDirectories(PROBLEMS_DIR);
  const completeDirectories = [];

  for (const directory of directories) {
    const fileChecks = await Promise.all(
      REQUIRED_FILES.map((fileName) => exists(path.join(directory, fileName)))
    );

    if (fileChecks.every(Boolean)) {
      completeDirectories.push(directory);
    }
  }

  return completeDirectories.sort();
}

function normalizeTestInput(input) {
  return Array.isArray(input) ? input : [input];
}

async function runValidationForDirectory(problemDir) {
  const relativeDir = path.relative(ROOT_DIR, problemDir).split(path.sep).join("/");
  const problemJsonPath = path.join(problemDir, "problem.json");
  const solutionPath = path.join(problemDir, "solution.js");
  const testsPath = path.join(problemDir, "tests.json");

  try {
    const [problem, testsFile] = await Promise.all([readJson(problemJsonPath), readJson(testsPath)]);
    const imported = await import(`${pathToFileURL(solutionPath).href}?t=${Date.now()}`);
    const solve = imported.default;

    if (typeof solve !== "function") {
      return {
        slug: problem.slug ?? path.basename(problemDir),
        platform: problem.platform ?? path.basename(path.dirname(problemDir)),
        verified: false,
        reason: "solution.js must export a default function"
      };
    }

    if (!Array.isArray(testsFile.tests) || testsFile.tests.length === 0) {
      return {
        slug: problem.slug ?? path.basename(problemDir),
        platform: problem.platform ?? path.basename(path.dirname(problemDir)),
        verified: false,
        reason: "tests.json must contain a non-empty tests array"
      };
    }

    for (let index = 0; index < testsFile.tests.length; index += 1) {
      const testCase = testsFile.tests[index];
      const args = normalizeTestInput(testCase.input);
      const actual = await solve(...args);

      if (!isDeepStrictEqual(actual, testCase.expected)) {
        return {
          slug: problem.slug ?? path.basename(problemDir),
          platform: problem.platform ?? path.basename(path.dirname(problemDir)),
          verified: false,
          reason: `test ${index + 1} failed`,
          failure: {
            input: testCase.input,
            expected: testCase.expected,
            actual
          }
        };
      }
    }

    return {
      slug: problem.slug ?? path.basename(problemDir),
      platform: problem.platform ?? path.basename(path.dirname(problemDir)),
      verified: true,
      reason: "all tests passed"
    };
  } catch (error) {
    return {
      slug: path.basename(problemDir),
      platform: path.basename(path.dirname(problemDir)),
      verified: false,
      reason: error instanceof Error ? error.message : "unknown validation error"
    };
  } finally {
    if (!(await exists(solutionPath))) {
      console.warn(`Skipped missing solution for ${relativeDir}`);
    }
  }
}

export async function validateProblems() {
  const completeDirectories = await getCompleteProblemDirectories();
  const results = [];

  for (const problemDir of completeDirectories) {
    results.push(await runValidationForDirectory(problemDir));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalChecked: results.length,
    totalVerified: results.filter((result) => result.verified).length,
    results
  };

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(VALIDATION_RESULTS_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  return summary;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  const summary = await validateProblems();
  console.log(
    `Validated ${summary.totalChecked} problem(s); ${summary.totalVerified} verified.`
  );
}
