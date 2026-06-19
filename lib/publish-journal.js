import { execSync } from "node:child_process";
import path from "node:path";
import {
  createProblemKey,
  getProblemJsonDirectories,
  getSolutionEntries,
  loadValidationMap,
  normalizeAllProblemJsonPlatforms,
  normalizeProblemRecord,
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
    problemsMissingCode: problems.filter(
      (problem) => (problem.submissions ?? []).some((submission) => submission.codeAvailable === false)
    ).length,
    byPlatform: {},
    byLanguage: {},
    byDifficulty: {},
    byTag: {}
  };

  for (const problem of problems) {
    if (problem.platform) {
      stats.byPlatform[problem.platform] = (stats.byPlatform[problem.platform] ?? 0) + 1;
    }

    const languages = new Set();

    for (const solution of problem.solutions ?? []) {
      if (solution.language) {
        languages.add(solution.language);
      }
    }

    for (const submission of problem.submissions ?? []) {
      if (submission.language) {
        languages.add(submission.language);
      }
    }

    if (languages.size === 0 && problem.language) {
      languages.add(problem.language);
    }

    for (const language of languages) {
      stats.byLanguage[language] = (stats.byLanguage[language] ?? 0) + 1;
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
      verifiedProblems: problems.filter((problem) => problem.verified).length,
      problemsMissingCode: problems.filter(
        (problem) => (problem.submissions ?? []).some((submission) => submission.codeAvailable === false)
      ).length
    }
  };
}

function stripGeneratedAt(metadata = {}) {
  const { generatedAt: _generatedAt, ...rest } = metadata;
  return rest;
}

async function buildPublishedProblem(rootDir, directory, repositoryContext, validationMap) {
  const problemJsonPath = path.join(directory, "problem.json");
  const explanationPath = path.join(directory, "explanation.md");
  const [rawProblem, explanation, solutions] = await Promise.all([
    readJson(problemJsonPath),
    readText(explanationPath).catch(() => ""),
    getSolutionEntries(rootDir, directory)
  ]);
  const problem = normalizeProblemRecord(rawProblem, path.basename(path.dirname(directory)));
  const validationResult = validationMap.get(createProblemKey(problem));
  const hasCode = solutions.length > 0;
  const relativeDetailPath = path
    .relative(rootDir, explanation ? explanationPath : problemJsonPath)
    .split(path.sep)
    .join("/");

  return {
    ...problem,
    explanation,
    hasCode,
    solutionCount: solutions.length,
    solutions,
    verified: validationResult?.verified === true,
    detailUrl: repositoryContext.rawBaseUrl
      ? `${repositoryContext.rawBaseUrl}/${relativeDetailPath}`
      : null
  };
}

export async function publishJournalData(options = {}) {
  const rootDir = resolveRootDir(options);
  const { dataDir } = resolvePaths({ rootDir });
  await normalizeAllProblemJsonPlatforms(rootDir);
  const validationMap = await loadValidationMap(rootDir);
  const repositoryContext = getRepositoryContext(rootDir);
  const problemDirectories = await getProblemJsonDirectories(rootDir);
  const problems = await Promise.all(
    problemDirectories.map((directory) => buildPublishedProblem(rootDir, directory, repositoryContext, validationMap))
  );

  const stats = buildStats(problems);
  const metadataPath = path.join(dataDir, "metadata.json");
  const nextMetadata = buildMetadata(repositoryContext, problems);
  const existingMetadata = await readJson(metadataPath).catch(() => null);
  const metadata = existingMetadata && JSON.stringify(stripGeneratedAt(existingMetadata)) === JSON.stringify(stripGeneratedAt(nextMetadata))
    ? {
        ...nextMetadata,
        generatedAt: existingMetadata.generatedAt
      }
    : nextMetadata;

  await Promise.all([
    writeJson(path.join(dataDir, "problems.json"), problems),
    writeJson(path.join(dataDir, "stats.json"), stats),
    writeJson(metadataPath, metadata)
  ]);

  return { problems, stats, metadata };
}
