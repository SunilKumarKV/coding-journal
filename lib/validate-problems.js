import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import {
  getCompleteProblemDirectories,
  getJavaScriptSolutionPath,
  readJson,
  resolvePaths,
  resolveRootDir,
  writeJson
} from "./journal.js";

function formatPlatform(problemDir, problem) {
  return String(problem.platform ?? path.basename(path.dirname(problemDir))).toLowerCase();
}

function buildUnverifiedResult(problemDir, problem, reason, extras = {}) {
  return {
    slug: problem.slug ?? path.basename(problemDir),
    platform: formatPlatform(problemDir, problem),
    verified: false,
    reason,
    ...extras
  };
}

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
  const testsPath = path.join(problemDir, "tests.json");

  try {
    const [problem, testsFile] = await Promise.all([readJson(problemJsonPath), readJson(testsPath)]);
    const solutionPath = await getJavaScriptSolutionPath(problemDir);

    if (!solutionPath) {
      const expectsJavaScriptValidation =
        String(problem.language ?? "").toLowerCase() === "javascript" ||
        (problem.submissions ?? []).some(
          (submission) =>
            String(submission.language ?? "").toLowerCase() === "javascript" && submission.codeAvailable !== false
        );

      if (!expectsJavaScriptValidation) {
        await updateProblemVerification(problemJsonPath, false);
        return null;
      }

      await updateProblemVerification(problemJsonPath, false);
      return buildUnverifiedResult(problemDir, problem, "JavaScript solution file is missing");
    }

    const imported = await import(`${pathToFileURL(solutionPath).href}?t=${Date.now()}`);
    const solve = imported.default;

    if (typeof solve !== "function") {
      await updateProblemVerification(problemJsonPath, false);
      return buildUnverifiedResult(problemDir, problem, "JavaScript solution does not export default function");
    }

    if (!Array.isArray(testsFile.tests) || testsFile.tests.length === 0) {
      await updateProblemVerification(problemJsonPath, false);
      return buildUnverifiedResult(problemDir, problem, "tests.json must contain a non-empty tests array");
    }

    for (let index = 0; index < testsFile.tests.length; index += 1) {
      const testCase = testsFile.tests[index];
      const args = normalizeTestInput(testCase.input);
      const label = testCase.name || `example ${index + 1}`;
      let actual;

      try {
        actual = await solve(...args);
      } catch (error) {
        await updateProblemVerification(problemJsonPath, false);
        return buildUnverifiedResult(problemDir, problem, `test "${label}" threw an error`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      if (!isDeepStrictEqual(actual, testCase.expected)) {
        await updateProblemVerification(problemJsonPath, false);
        return buildUnverifiedResult(problemDir, problem, `test "${label}" failed`, {
          expected: testCase.expected,
          received: actual
        });
      }
    }

    await updateProblemVerification(problemJsonPath, true);
    return {
      slug: problem.slug ?? path.basename(problemDir),
      platform: formatPlatform(problemDir, problem),
      verified: true,
      reason: "all tests passed"
    };
  } catch (error) {
    await updateProblemVerification(problemJsonPath, false).catch(() => {});
    return buildUnverifiedResult(problemDir, { slug: path.basename(problemDir) }, "validation setup error", {
      error: error instanceof Error ? error.message : "unknown validation error"
    });
  }
}

export async function validateProblems(options = {}) {
  const rootDir = resolveRootDir(options);
  const { cacheDir, validationResultsPath } = resolvePaths({ rootDir });
  const completeDirectories = await getCompleteProblemDirectories(rootDir);
  const results = [];

  for (const problemDir of completeDirectories) {
    const result = await runValidationForDirectory(problemDir);
    if (result) {
      results.push(result);
    }
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

function formatValue(value) {
  return JSON.stringify(value);
}

export function formatValidationSummary(summary) {
  const lines = [`Validated ${summary.totalChecked} problem(s); ${summary.totalVerified} verified.`];
  const unverified = summary.results.filter((result) => !result.verified);

  for (const result of unverified) {
    lines.push("");
    lines.push("[unverified]");
    lines.push(`platform: ${result.platform}`);
    lines.push(`slug: ${result.slug}`);
    lines.push(`reason: ${result.reason}`);

    if (result.expected !== undefined) {
      lines.push(`expected: ${formatValue(result.expected)}`);
    }

    if (result.received !== undefined) {
      lines.push(`received: ${formatValue(result.received)}`);
    }

    if (result.error) {
      lines.push(`error: ${result.error}`);
    }
  }

  return lines.join("\n");
}
