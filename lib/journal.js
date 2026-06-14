import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { REQUIRED_FILES, PLATFORM_CONFIG, getPaths, getRootDir } from "./constants.js";

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
      REQUIRED_FILES.map((fileName) => exists(path.join(directory, fileName)))
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
