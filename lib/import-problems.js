import path from "node:path";
import { DEFAULT_SOLUTION_TEMPLATES } from "./constants.js";
import {
  buildProblemTemplate,
  createProblemScaffold,
  ensureBaseStructure,
  exists,
  getProblemDirectory,
  normalizePlatform,
  resolveRootDir
} from "./journal.js";
import { getPlatformAdapter } from "./platforms/index.js";

function normalizedToProblemJson(platformKey, normalizedProblem) {
  const template = buildProblemTemplate(platformKey, normalizedProblem.slug);

  return {
    ...template,
    title: normalizedProblem.title || template.title,
    slug: normalizedProblem.slug,
    difficulty: normalizedProblem.difficulty || template.difficulty,
    url: normalizedProblem.url || template.url,
    tags: normalizedProblem.tags ?? [],
    solvedAt: normalizedProblem.solvedAt ?? null,
    source: normalizedProblem.source ?? "template"
  };
}

export async function importSingleProblem(platformInput, slugOrUrl, options = {}) {
  const rootDir = resolveRootDir(options);
  const platformKey = normalizePlatform(platformInput);

  if (!platformKey) {
    throw new Error(`Unsupported platform: ${platformInput}`);
  }

  await ensureBaseStructure(rootDir);

  const adapter = getPlatformAdapter(platformKey);
  const normalizedProblem = adapter
    ? await adapter.fetchProblemDetails(slugOrUrl, options)
    : {
        ...buildProblemTemplate(platformKey, String(slugOrUrl).trim())
      };
  const problemData = normalizedToProblemJson(platformKey, normalizedProblem);

  return createProblemScaffold(rootDir, platformKey, problemData.slug, problemData, {
    ...options,
    solutionFilenames: DEFAULT_SOLUTION_TEMPLATES.map((item) => item.filename)
  });
}

export async function importPlatformProblems(platformInput, username, options = {}) {
  const rootDir = resolveRootDir(options);
  const platformKey = normalizePlatform(platformInput);

  if (!platformKey) {
    throw new Error(`Unsupported platform: ${platformInput}`);
  }

  const adapter = getPlatformAdapter(platformKey);

  if (!adapter) {
    throw new Error(`No adapter available for platform: ${platformInput}`);
  }

  await ensureBaseStructure(rootDir);
  const result = await adapter.fetchSolvedProblems(username, options);
  const created = [];
  const skipped = [];

  for (const normalizedProblem of result.problems) {
    const problemData = normalizedToProblemJson(platformKey, normalizedProblem);
    const problemDir = getProblemDirectory(rootDir, platformKey, problemData.slug);

    if (!options.force && (await exists(problemDir))) {
      skipped.push(path.relative(rootDir, problemDir));
      continue;
    }

    const scaffoldResult = await createProblemScaffold(rootDir, platformKey, problemData.slug, problemData, {
      ...options,
      solutionFilenames: ["javascript.js"]
    });
    created.push(path.relative(rootDir, scaffoldResult.problemDir));
  }

  return {
    created,
    skipped,
    warning: result.warning ?? null,
    importedCount: created.length,
    totalFetched: result.problems.length
  };
}
