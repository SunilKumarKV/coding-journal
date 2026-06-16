import { execSync } from "node:child_process";
import path from "node:path";
import {
  createProblemKey,
  getCompleteProblemDirectories,
  getSolutionEntries,
  loadValidationMap,
  readJson,
  readText,
  resolvePaths,
  resolveRootDir,
  writeJson
} from "./journal.js";

function safeExec(command, cwd, fallback = "") {
  try {
    return execSync(command, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return fallback;
  }
}

function getRepositoryContext(rootDir) {
  const remoteUrl = safeExec("git config --get remote.origin.url", rootDir, "");
  const branch = process.env.GITHUB_REF_NAME || safeExec("git branch --show-current", rootDir, "") || "main";

  let owner = "";
  let repo = "";
  const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);

  if (match) {
    owner = match[1];
    repo = match[2];
  }

  return {
    remoteUrl,
    owner,
    repo,
    branch,
    rawBaseUrl: owner && repo ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}` : null
  };
}

export function buildStats(problems) {
  const stats = {
    totalProblems: problems.length,
    verifiedProblems: problems.filter((problem) => problem.verified).length,
    byPlatform: {},
    byLanguage: {},
    byDifficulty: {},
    byTag: {}
  };

  for (const problem of problems) {
    if (problem.platform) {
      stats.byPlatform[problem.platform] = (stats.byPlatform[problem.platform] ?? 0) + 1;
    }

    if (problem.language) {
      stats.byLanguage[problem.language] = (stats.byLanguage[problem.language] ?? 0) + 1;
    }

    if (problem.difficulty) {
      stats.byDifficulty[problem.difficulty] = (stats.byDifficulty[problem.difficulty] ?? 0) + 1;
    }

    for (const tag of problem.tags ?? []) {
      stats.byTag[tag] = (stats.byTag[tag] ?? 0) + 1;
    }
  }

  return stats;
}

export function buildMetadata(repositoryContext, problems) {
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
      verifiedProblems: problems.filter((problem) => problem.verified).length
    }
  };
}

export async function publishJournalData(options = {}) {
  const rootDir = resolveRootDir(options);
  const { dataDir } = resolvePaths({ rootDir });
  const validationMap = await loadValidationMap(rootDir);
  const repositoryContext = getRepositoryContext(rootDir);
  const completeDirectories = await getCompleteProblemDirectories(rootDir);
  const problems = [];

  for (const directory of completeDirectories) {
    const [problem, explanation, solutions] = await Promise.all([
      readJson(path.join(directory, "problem.json")),
      readText(path.join(directory, "explanation.md")),
      getSolutionEntries(rootDir, directory)
    ]);
    const relativeExplanationPath = path
      .relative(rootDir, path.join(directory, "explanation.md"))
      .split(path.sep)
      .join("/");
    const validationResult = validationMap.get(createProblemKey(problem));

    problems.push({
      ...problem,
      explanation,
      solutions,
      verified: validationResult?.verified === true,
      detailUrl: repositoryContext.rawBaseUrl
        ? `${repositoryContext.rawBaseUrl}/${relativeExplanationPath}`
        : null
    });
  }

  const stats = buildStats(problems);
  const metadata = buildMetadata(repositoryContext, problems);

  await Promise.all([
    writeJson(path.join(dataDir, "problems.json"), problems),
    writeJson(path.join(dataDir, "stats.json"), stats),
    writeJson(path.join(dataDir, "metadata.json"), metadata)
  ]);

  return { problems, stats, metadata };
}
