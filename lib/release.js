import path from "node:path";
import { runSync } from "./run-sync.js";
import { createProblemKey, readJson, resolveRootDir, writeTextFile } from "./journal.js";

const DEFAULT_RELEASE_TITLE = "feat: sync coding journal progress";
const RELEASE_PATH = "docs/releases/latest.md";

function sortStrings(values = []) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function formatCountMap(counts = {}) {
  return Object.entries(counts)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, value]) => `${key}: ${value}`);
}

function getProblemLanguages(problem = {}) {
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

  if (problem.language) {
    languages.add(problem.language);
  }

  return languages;
}

function bySolvedAtDescending(left, right) {
  const leftTime = left.solvedAt ? Date.parse(left.solvedAt) : 0;
  const rightTime = right.solvedAt ? Date.parse(right.solvedAt) : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return String(left.title).localeCompare(String(right.title));
}

export function collectReleaseChanges(previousProblems = [], currentProblems = []) {
  const previousKeys = new Set(previousProblems.map((problem) => createProblemKey(problem)));
  const previousLanguages = new Set(previousProblems.flatMap((problem) => [...getProblemLanguages(problem)]));

  const newProblems = currentProblems
    .filter((problem) => !previousKeys.has(createProblemKey(problem)))
    .sort(bySolvedAtDescending);

  const currentLanguages = new Set(currentProblems.flatMap((problem) => [...getProblemLanguages(problem)]));
  const newLanguages = sortStrings([...currentLanguages].filter((language) => !previousLanguages.has(language)));

  const recentActivity = [...currentProblems]
    .filter((problem) => problem.solvedAt)
    .sort(bySolvedAtDescending)
    .slice(0, 5);

  return {
    newProblems,
    newLanguages,
    recentActivity
  };
}

function renderBulletList(values = [], formatter = (value) => value) {
  if (values.length === 0) {
    return "* none";
  }

  return values.map((value) => `* ${formatter(value)}`).join("\n");
}

export function renderReleaseMarkdown(summary) {
  const { changes, stats } = summary;

  return `# Coding Journal Update

## New Problems

${renderBulletList(changes.newProblems, (problem) => problem.title)}

## Languages Added

${renderBulletList(changes.newLanguages)}

## Stats

* Total Problems: ${stats.totalProblems}
* Verified Problems: ${stats.verifiedProblems}
* Platforms: ${formatCountMap(stats.byPlatform).join(", ") || "none"}
* Languages: ${formatCountMap(stats.byLanguage).join(", ") || "none"}

## Recent Activity

${renderBulletList(changes.recentActivity, (problem) => {
    const solvedAt = problem.solvedAt ? ` — ${problem.solvedAt}` : "";
    return `${problem.title} (${problem.platform})${solvedAt}`;
  })}
`;
}

export function buildReleasePrTitle() {
  return DEFAULT_RELEASE_TITLE;
}

export function buildReleasePrDescription(summary) {
  const { changes, stats } = summary;

  return `## Summary

${renderBulletList(changes.newProblems, (problem) => `Added ${problem.title}`)}

## Languages Added

${renderBulletList(changes.newLanguages)}

## Stats

* Total Problems: ${stats.totalProblems}
* Verified Problems: ${stats.verifiedProblems}
* Platforms: ${formatCountMap(stats.byPlatform).join(", ") || "none"}
* Languages: ${formatCountMap(stats.byLanguage).join(", ") || "none"}

## Recent Activity

${renderBulletList(changes.recentActivity, (problem) => problem.title)}
`;
}

async function readProblemsJson(rootDir) {
  return readJson(path.join(rootDir, "data", "problems.json")).catch(() => []);
}

async function readStatsJson(rootDir) {
  return readJson(path.join(rootDir, "data", "stats.json")).catch(() => ({
    totalProblems: 0,
    verifiedProblems: 0,
    byPlatform: {},
    byLanguage: {}
  }));
}

export async function prepareRelease(options = {}) {
  const rootDir = resolveRootDir(options);
  const syncRunner = options.syncRunner ?? runSync;
  const beforeProblems = await readProblemsJson(rootDir);

  const syncResult = await syncRunner({ rootDir });

  const [afterProblems, afterStats] = await Promise.all([
    readProblemsJson(rootDir),
    readStatsJson(rootDir)
  ]);

  const changes = collectReleaseChanges(beforeProblems, afterProblems);
  const summary = {
    changes,
    stats: {
      totalProblems: afterStats.totalProblems ?? syncResult.summary.totalProblems,
      verifiedProblems: afterStats.verifiedProblems ?? syncResult.summary.verifiedProblems,
      byPlatform: afterStats.byPlatform ?? {},
      byLanguage: afterStats.byLanguage ?? {}
    }
  };

  const markdown = renderReleaseMarkdown(summary);
  const prTitle = buildReleasePrTitle();
  const prDescription = buildReleasePrDescription(summary);
  const releasePath = path.join(rootDir, RELEASE_PATH);

  await writeTextFile(releasePath, markdown.endsWith("\n") ? markdown : `${markdown}\n`, { force: true });

  return {
    releasePath,
    markdown,
    prTitle,
    prDescription,
    summary
  };
}
