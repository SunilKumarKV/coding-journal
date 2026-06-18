import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SOLUTION_TEMPLATES,
  JAVASCRIPT_SOLUTION_FILENAME,
  LEGACY_SOLUTION_FILENAME,
  LANGUAGE_FILE_MAP,
  PLATFORM_CONFIG,
  REQUIRED_BASE_FILES,
  SOLUTIONS_DIRECTORY,
  SOLUTION_LANGUAGE_MAP,
  getPaths,
  getRootDir
} from "./constants.js";

export function resolveRootDir(options = {}) {
  return getRootDir(options.rootDir);
}

export function resolvePaths(options = {}) {
  return getPaths(resolveRootDir(options));
}

export async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function slugToTitle(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizePlatform(inputPlatform) {
  const key = String(inputPlatform).trim().toLowerCase();
  return PLATFORM_CONFIG[key] ? key : null;
}

export async function ensureBaseStructure(rootDir) {
  const { problemsDir, dataDir, cacheDir } = getPaths(rootDir);

  await Promise.all([
    mkdir(problemsDir, { recursive: true }),
    mkdir(dataDir, { recursive: true }),
    mkdir(cacheDir, { recursive: true })
  ]);

  await Promise.all(
    Object.values(PLATFORM_CONFIG).map((platform) =>
      mkdir(path.join(problemsDir, platform.directory), { recursive: true })
    )
  );
}

export async function collectProblemDirectories(rootDir) {
  const { problemsDir } = getPaths(rootDir);
  const directories = [];
  const platformEntries = await readdir(problemsDir, { withFileTypes: true }).catch(() => []);

  for (const platformEntry of platformEntries) {
    if (!platformEntry.isDirectory()) {
      continue;
    }

    const platformDir = path.join(problemsDir, platformEntry.name);
    const problemEntries = await readdir(platformDir, { withFileTypes: true }).catch(() => []);

    for (const problemEntry of problemEntries) {
      if (!problemEntry.isDirectory()) {
        continue;
      }

      directories.push(path.join(platformDir, problemEntry.name));
    }
  }

  return directories.sort();
}

export async function getCompleteProblemDirectories(rootDir) {
  const directories = await collectProblemDirectories(rootDir);
  const completeDirectories = [];

  for (const directory of directories) {
    const checks = await Promise.all(
      REQUIRED_BASE_FILES.map((fileName) => exists(path.join(directory, fileName)))
    );

    if (checks.every(Boolean)) {
      completeDirectories.push(directory);
    }
  }

  return completeDirectories;
}

export function createProblemKey(problem) {
  return `${String(problem.platform).toLowerCase()}::${problem.slug}`;
}

export async function loadValidationMap(rootDir) {
  const { validationResultsPath } = getPaths(rootDir);

  if (!(await exists(validationResultsPath))) {
    return new Map();
  }

  const validationSummary = await readJson(validationResultsPath);
  return new Map(
    (validationSummary.results ?? []).map((result) => [
      `${String(result.platform).toLowerCase()}::${result.slug}`,
      result
    ])
  );
}

export function buildProblemTemplate(platformKey, slug) {
  const platform = PLATFORM_CONFIG[platformKey];

  return {
    title: slugToTitle(slug),
    slug,
    platform: platform.label,
    difficulty: "",
    url: platform.buildUrl(slug),
    status: "Solved",
    language: "JavaScript",
    tags: [],
    timeComplexity: "",
    spaceComplexity: "",
    verified: false
  };
}

export function buildSolutionTemplate(slug) {
  return `export default function solve(...args) {\n  throw new Error("Implement solution for ${slug}");\n}\n`;
}

export function buildTestsTemplate() {
  return `${JSON.stringify({ tests: [] }, null, 2)}\n`;
}

export function buildExplanationTemplate(title) {
  return `# ${title}\n\n## Approach\n\nDescribe the solution strategy.\n\n## Time Complexity\n\n\`\`\`text\nAdd time complexity\n\`\`\`\n\n## Space Complexity\n\n\`\`\`text\nAdd space complexity\n\`\`\`\n\n## Step-By-Step Example\n\nWalk through one example input.\n`;
}

export async function readText(filePath) {
  return readFile(filePath, "utf8");
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function inferLanguageFromFilename(filename) {
  const parsed = path.parse(filename);
  const stem = parsed.name.toLowerCase();
  const extension = parsed.ext.replace(/^\./, "").toLowerCase();

  return (
    SOLUTION_LANGUAGE_MAP[stem] ||
    SOLUTION_LANGUAGE_MAP[extension] ||
    stem.charAt(0).toUpperCase() + stem.slice(1)
  );
}

export async function getSolutionEntries(rootDir, problemDir) {
  const solutionEntries = [];
  const legacyPath = path.join(problemDir, LEGACY_SOLUTION_FILENAME);

  if (await exists(legacyPath)) {
    solutionEntries.push({
      language: "JavaScript",
      filename: LEGACY_SOLUTION_FILENAME,
      code: await readText(legacyPath),
      path: path.relative(rootDir, legacyPath).split(path.sep).join("/")
    });
  }

  const solutionsDir = path.join(problemDir, SOLUTIONS_DIRECTORY);
  const directoryEntries = await readdir(solutionsDir, { withFileTypes: true }).catch(() => []);

  for (const entry of directoryEntries) {
    if (!entry.isFile()) {
      continue;
    }

    const solutionPath = path.join(solutionsDir, entry.name);
    solutionEntries.push({
      language: inferLanguageFromFilename(entry.name),
      filename: entry.name,
      code: await readText(solutionPath),
      path: path.relative(rootDir, solutionPath).split(path.sep).join("/")
    });
  }

  return solutionEntries.sort((left, right) => left.filename.localeCompare(right.filename));
}

export async function getJavaScriptSolutionPath(problemDir) {
  const nestedJavaScriptPath = path.join(problemDir, SOLUTIONS_DIRECTORY, JAVASCRIPT_SOLUTION_FILENAME);

  if (await exists(nestedJavaScriptPath)) {
    return nestedJavaScriptPath;
  }

  const nestedEntries = await readdir(path.join(problemDir, SOLUTIONS_DIRECTORY), { withFileTypes: true }).catch(() => []);

  for (const entry of nestedEntries) {
    if (!entry.isFile()) {
      continue;
    }

    if (path.extname(entry.name).toLowerCase() === ".js") {
      return path.join(problemDir, SOLUTIONS_DIRECTORY, entry.name);
    }
  }

  const legacyPath = path.join(problemDir, LEGACY_SOLUTION_FILENAME);

  if (await exists(legacyPath)) {
    return legacyPath;
  }

  return null;
}

export function normalizeLanguageKey(input) {
  return String(input).trim().toLowerCase();
}

export function getLanguageFileInfo(inputLanguage) {
  return LANGUAGE_FILE_MAP[normalizeLanguageKey(inputLanguage)] ?? null;
}

export function createSubmissionRecord(input = {}) {
  return {
    language: input.language ?? null,
    submittedAt: input.submittedAt ?? null,
    source: input.source ?? null,
    codeAvailable: input.codeAvailable === true,
    filename: input.filename ?? null
  };
}

export function mergeSubmissionRecords(existing = [], incoming = []) {
  const merged = new Map();

  for (const record of [...existing, ...incoming]) {
    const normalized = createSubmissionRecord(record);
    const key = `${normalized.language ?? ""}::${normalized.source ?? ""}::${normalized.filename ?? ""}`;
    const current = merged.get(key);

    if (!current) {
      merged.set(key, normalized);
      continue;
    }

    merged.set(key, {
      ...current,
      ...normalized,
      codeAvailable: current.codeAvailable || normalized.codeAvailable,
      submittedAt: normalized.submittedAt ?? current.submittedAt
    });
  }

  return Array.from(merged.values());
}

export function buildJavaSolutionTemplate(slug) {
  return `public class Solution {\n    public static void main(String[] args) {\n        // Implement solution for ${slug}\n    }\n}\n`;
}

export function buildCSolutionTemplate(slug) {
  return `#include <stdio.h>\n\nint main(void) {\n    /* Implement solution for ${slug} */\n    return 0;\n}\n`;
}

export function buildInitialExplanationTemplate(problem) {
  return `# ${problem.title}\n\n## Approach\n\nDocument the solution strategy for ${problem.title}.\n\n## Time Complexity\n\n\`\`\`text\nO(?)\n\`\`\`\n\n## Space Complexity\n\n\`\`\`text\nO(?)\n\`\`\`\n\n## Step-By-Step Example\n\nAdd an example walkthrough from tests when available.\n`;
}

export function buildSolutionTemplateForFilename(filename, slug) {
  const normalized = filename.toLowerCase();

  if (normalized === "java.java") {
    return buildJavaSolutionTemplate(slug);
  }

  if (normalized === "c.c") {
    return buildCSolutionTemplate(slug);
  }

  return buildSolutionTemplate(slug);
}

export async function writeTextFile(filePath, content, options = {}) {
  if (!options.force && (await exists(filePath))) {
    return false;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return true;
}

export function getProblemDirectory(rootDir, platformKey, slug) {
  return path.join(rootDir, "problems", PLATFORM_CONFIG[platformKey].directory, slug);
}

export async function createProblemScaffold(rootDir, platformKey, slug, problemData, options = {}) {
  const problemDir = getProblemDirectory(rootDir, platformKey, slug);
  const solutionFilenames = options.solutionFilenames ?? DEFAULT_SOLUTION_TEMPLATES.map((item) => item.filename);
  const created = [];
  const skipped = [];

  await mkdir(problemDir, { recursive: true });
  await mkdir(path.join(problemDir, SOLUTIONS_DIRECTORY), { recursive: true });

  const problemJsonPath = path.join(problemDir, "problem.json");
  if (options.force || !(await exists(problemJsonPath))) {
    await writeJson(problemJsonPath, problemData);
    created.push(problemJsonPath);
  } else {
    skipped.push(problemJsonPath);
  }

  const explanationPath = path.join(problemDir, "explanation.md");
  if (await writeTextFile(explanationPath, buildInitialExplanationTemplate(problemData), options)) {
    created.push(explanationPath);
  } else {
    skipped.push(explanationPath);
  }

  const testsPath = path.join(problemDir, "tests.json");
  if (await writeTextFile(testsPath, buildTestsTemplate(), options)) {
    created.push(testsPath);
  } else {
    skipped.push(testsPath);
  }

  for (const filename of solutionFilenames) {
    const solutionPath = path.join(problemDir, SOLUTIONS_DIRECTORY, filename);
    if (await writeTextFile(solutionPath, buildSolutionTemplateForFilename(filename, slug), options)) {
      created.push(solutionPath);
    } else {
      skipped.push(solutionPath);
    }
  }

  return {
    problemDir,
    created,
    skipped
  };
}

export async function loadProblemJson(rootDir, platformKey, slug) {
  return readJson(path.join(getProblemDirectory(rootDir, platformKey, slug), "problem.json"));
}

export async function upsertProblemJson(rootDir, platformKey, slug, updates) {
  const problemDir = getProblemDirectory(rootDir, platformKey, slug);
  const problemJsonPath = path.join(problemDir, "problem.json");
  const existing = (await exists(problemJsonPath)) ? await readJson(problemJsonPath) : {};
  const merged = {
    ...existing,
    ...updates,
    submissions: mergeSubmissionRecords(existing.submissions ?? [], updates.submissions ?? [])
  };
  await writeJson(problemJsonPath, merged);
  return merged;
}
