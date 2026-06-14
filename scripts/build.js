import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fetchPublicProjects } from "./github-projects-sync.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PROBLEMS_DIR = path.join(ROOT_DIR, "problems");
const DATA_DIR = path.join(ROOT_DIR, "data");
const VALIDATION_RESULTS_PATH = path.join(ROOT_DIR, ".cache", "validation-results.json");

const REQUIRED_FILES = ["problem.json", "solution.js", "tests.json", "explanation.md"];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
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

  return directories.sort();
}

async function getCompleteProblemDirectories() {
  const directories = await collectProblemDirectories(PROBLEMS_DIR);
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

function safeExec(command, fallback = "") {
  try {
    return execSync(command, {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return fallback;
  }
}

function getRepositoryContext() {
  const remoteUrl = safeExec("git config --get remote.origin.url", "");
  const branch =
    process.env.GITHUB_REF_NAME ||
    safeExec("git branch --show-current", "") ||
    "main";

  let owner = "";
  let repo = "";

  const httpsMatch = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);

  if (httpsMatch) {
    owner = httpsMatch[1];
    repo = httpsMatch[2];
  }

  const rawBaseUrl =
    owner && repo
      ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`
      : null;

  return {
    remoteUrl,
    owner,
    repo,
    branch,
    rawBaseUrl
  };
}

async function loadValidationMap() {
  if (!(await exists(VALIDATION_RESULTS_PATH))) {
    return new Map();
  }

  const validationSummary = await readJson(VALIDATION_RESULTS_PATH);
  return new Map(
    (validationSummary.results ?? []).map((result) => [
      `${String(result.platform).toLowerCase()}::${result.slug}`,
      result
    ])
  );
}

function createProblemKey(problem) {
  return `${String(problem.platform).toLowerCase()}::${problem.slug}`;
}

async function buildProblemsData(repositoryContext) {
  const validationMap = await loadValidationMap();
  const completeDirectories = await getCompleteProblemDirectories();
  const problems = [];

  for (const directory of completeDirectories) {
    const problemJson = await readJson(path.join(directory, "problem.json"));
    const relativeExplanationPath = path
      .relative(ROOT_DIR, path.join(directory, "explanation.md"))
      .split(path.sep)
      .join("/");
    const validationResult = validationMap.get(createProblemKey(problemJson));

    problems.push({
      ...problemJson,
      verified: validationResult?.verified === true,
      detailUrl: repositoryContext.rawBaseUrl
        ? `${repositoryContext.rawBaseUrl}/${relativeExplanationPath}`
        : null
    });
  }

  return problems;
}

function buildStats(problems, projects) {
  const stats = {
    totalProblems: problems.length,
    verifiedProblems: problems.filter((problem) => problem.verified).length,
    totalProjects: projects.length,
    byPlatform: {},
    byDifficulty: {},
    byTag: {}
  };

  for (const problem of problems) {
    stats.byPlatform[problem.platform] = (stats.byPlatform[problem.platform] ?? 0) + 1;
    stats.byDifficulty[problem.difficulty] = (stats.byDifficulty[problem.difficulty] ?? 0) + 1;

    for (const tag of problem.tags ?? []) {
      stats.byTag[tag] = (stats.byTag[tag] ?? 0) + 1;
    }
  }

  return stats;
}

function buildMetadata(repositoryContext, problems, projects) {
  return {
    generatedAt: new Date().toISOString(),
    repository: {
      remoteUrl: repositoryContext.remoteUrl,
      owner: repositoryContext.owner,
      name: repositoryContext.repo,
      branch: repositoryContext.branch,
      rawBaseUrl: repositoryContext.rawBaseUrl
    },
    counts: {
      problems: problems.length,
      verifiedProblems: problems.filter((problem) => problem.verified).length,
      projects: projects.length
    }
  };
}

export async function buildData() {
  const repositoryContext = getRepositoryContext();
  const [problems, projects] = await Promise.all([
    buildProblemsData(repositoryContext),
    fetchPublicProjects()
  ]);
  const stats = buildStats(problems, projects);
  const metadata = buildMetadata(repositoryContext, problems, projects);

  await mkdir(DATA_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(DATA_DIR, "problems.json"), `${JSON.stringify(problems, null, 2)}\n`, "utf8"),
    writeFile(path.join(DATA_DIR, "projects.json"), `${JSON.stringify(projects, null, 2)}\n`, "utf8"),
    writeFile(path.join(DATA_DIR, "stats.json"), `${JSON.stringify(stats, null, 2)}\n`, "utf8"),
    writeFile(path.join(DATA_DIR, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8")
  ]);

  return { problems, projects, stats, metadata };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  const result = await buildData();
  console.log(
    `Built ${result.problems.length} problem(s) and ${result.projects.length} project(s).`
  );
}
