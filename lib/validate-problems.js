import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { getCompleteProblemDirectories, readJson, resolvePaths, resolveRootDir, writeJson } from "./journal.js";

function normalizeTestInput(input) {
  return Array.isArray(input) ? input : [input];
}

async function updateProblemVerification(problemJsonPath, verified) {
  const problem = await readJson(problemJsonPath);
  problem.verified = verified;
  await writeJson(problemJsonPath, problem);
}

async function runValidationForDirectory(problemDir) {
  const problemJsonPath = path.join(problemDir, "problem.json");
  const solutionPath = path.join(problemDir, "solution.js");
  const testsPath = path.join(problemDir, "tests.json");

  try {
    const [problem, testsFile] = await Promise.all([readJson(problemJsonPath), readJson(testsPath)]);
    const imported = await import(`${pathToFileURL(solutionPath).href}?t=${Date.now()}`);
    const solve = imported.default;

    if (typeof solve !== "function") {
      await updateProblemVerification(problemJsonPath, false);
      return {
        slug: problem.slug ?? path.basename(problemDir),
        platform: problem.platform ?? path.basename(path.dirname(problemDir)),
        verified: false,
        reason: "solution.js must export a default function"
      };
    }

    if (!Array.isArray(testsFile.tests) || testsFile.tests.length === 0) {
      await updateProblemVerification(problemJsonPath, false);
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
        await updateProblemVerification(problemJsonPath, false);
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

    await updateProblemVerification(problemJsonPath, true);
    return {
      slug: problem.slug ?? path.basename(problemDir),
      platform: problem.platform ?? path.basename(path.dirname(problemDir)),
      verified: true,
      reason: "all tests passed"
    };
  } catch (error) {
    await updateProblemVerification(problemJsonPath, false).catch(() => {});
    return {
      slug: path.basename(problemDir),
      platform: path.basename(path.dirname(problemDir)),
      verified: false,
      reason: error instanceof Error ? error.message : "unknown validation error"
    };
  }
}

export async function validateProblems(options = {}) {
  const rootDir = resolveRootDir(options);
  const { cacheDir, validationResultsPath } = resolvePaths({ rootDir });
  const completeDirectories = await getCompleteProblemDirectories(rootDir);
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

  await mkdir(cacheDir, { recursive: true });
  await writeFile(validationResultsPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  return summary;
}
