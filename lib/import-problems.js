import path from "node:path";
import { copyFile } from "node:fs/promises";
import { DEFAULT_SOLUTION_TEMPLATES, SOLUTIONS_DIRECTORY } from "./constants.js";
import {
  buildSolutionTemplateForFilename,
  buildProblemTemplate,
  createProblemScaffold,
  createSubmissionRecord,
  ensureBaseStructure,
  exists,
  getLanguageFileInfo,
  getProblemDirectory,
  normalizePlatform,
  readText,
  resolveRootDir,
  upsertProblemJson,
  writeTextFile
} from "./journal.js";
import { getPlatformAdapter } from "./platforms/index.js";

function normalizedToProblemJson(platformKey, normalizedProblem) {
  const template = buildProblemTemplate(platformKey, normalizedProblem.slug);

  return {
    ...template,
    platform: platformKey,
    title: normalizedProblem.title || template.title,
    slug: normalizedProblem.slug,
    difficulty: normalizedProblem.difficulty || template.difficulty,
    url: normalizedProblem.url || template.url,
    tags: normalizedProblem.tags ?? [],
    solvedAt: normalizedProblem.solvedAt ?? null,
    source: normalizedProblem.source ?? "template",
    submissions: (normalizedProblem.submissions ?? []).map((submission) => createSubmissionRecord(submission))
  };
}

async function ensureMetadataOnlyScaffold(rootDir, platformKey, problemData, options = {}) {
  const problemDir = getProblemDirectory(rootDir, platformKey, problemData.slug);
  const scaffoldResult = await createProblemScaffold(rootDir, platformKey, problemData.slug, problemData, {
    ...options,
    solutionFilenames: []
  });

  await upsertProblemJson(rootDir, platformKey, problemData.slug, problemData);

  return {
    problemDir,
    created: scaffoldResult.created,
    skipped: scaffoldResult.skipped
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
    : { ...buildProblemTemplate(platformKey, String(slugOrUrl).trim()) };
  const problemData = normalizedToProblemJson(platformKey, normalizedProblem);

  return createProblemScaffold(rootDir, platformKey, problemData.slug, problemData, {
    ...options,
    solutionFilenames: DEFAULT_SOLUTION_TEMPLATES.map((item) => item.filename)
  });
}

export async function pullPlatformProblems(platformInput, username, options = {}) {
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
  const updated = [];
  const skipped = [];

  for (const normalizedProblem of result.problems) {
    const problemData = normalizedToProblemJson(platformKey, normalizedProblem);
    const problemDir = getProblemDirectory(rootDir, platformKey, problemData.slug);

    if (await exists(problemDir)) {
      if (options.force) {
        await ensureMetadataOnlyScaffold(rootDir, platformKey, problemData, options);
        updated.push(path.relative(rootDir, problemDir));
      } else {
        await upsertProblemJson(rootDir, platformKey, problemData.slug, problemData);
        skipped.push(path.relative(rootDir, problemDir));
      }
      continue;
    }

    const scaffoldResult = await ensureMetadataOnlyScaffold(rootDir, platformKey, problemData, options);
    created.push(path.relative(rootDir, scaffoldResult.problemDir));
  }

  return {
    created,
    updated,
    skipped,
    warning: result.warning ?? null,
    importedCount: created.length + updated.length,
    totalFetched: result.problems.length
  };
}

export async function importSubmission(platformInput, slug, options = {}) {
  const rootDir = resolveRootDir(options);
  const platformKey = normalizePlatform(platformInput);

  if (!platformKey) {
    throw new Error(`Unsupported platform: ${platformInput}`);
  }

  const languageInfo = getLanguageFileInfo(options.language);

  if (!languageInfo) {
    throw new Error(`Unsupported language: ${options.language}`);
  }

  const sourceFile = path.resolve(String(options.file));
  if (!(await exists(sourceFile))) {
    throw new Error(`Submission file not found: ${sourceFile}`);
  }

  const problemDir = getProblemDirectory(rootDir, platformKey, slug);
  if (!(await exists(problemDir))) {
    throw new Error(`Problem does not exist: ${problemDir}`);
  }

  const destinationPath = path.join(problemDir, SOLUTIONS_DIRECTORY, languageInfo.filename);

  if (!options.force && (await exists(destinationPath))) {
    const existingContent = await readText(destinationPath);
    const generatedTemplate = buildSolutionTemplateForFilename(languageInfo.filename, slug);

    if (existingContent !== generatedTemplate && existingContent.trim() !== "") {
      throw new Error(`Solution already exists: ${destinationPath}`);
    }
  }

  await writeTextFile(destinationPath, "", { force: true });
  await copyFile(sourceFile, destinationPath);

  const submission = createSubmissionRecord({
    language: languageInfo.language,
    submittedAt: options.submittedAt ?? new Date().toISOString(),
    source: platformKey,
    codeAvailable: true,
    filename: path.join(SOLUTIONS_DIRECTORY, languageInfo.filename).replaceAll("\\", "/")
  });

  const updatedProblem = await upsertProblemJson(rootDir, platformKey, slug, {
    submissions: [submission]
  });

  return {
    destinationPath,
    problem: updatedProblem,
    submission
  };
}
