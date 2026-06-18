import path from "node:path";
import { SOLUTIONS_DIRECTORY } from "./constants.js";
import {
  buildProblemTemplate,
  createSubmissionRecord,
  ensureBaseStructure,
  exists,
  getLanguageFileInfo,
  getProblemDirectory,
  normalizePlatform,
  readJson,
  resolveRootDir,
  slugify,
  upsertProblemJson,
  writeTextFile
} from "./journal.js";
import { explainProblemWithAI, shouldAutoExplainProblem } from "./explain-problem.js";
import { runSync } from "./run-sync.js";

function buildProblemData(platformKey, payload, existingProblem = {}) {
  const template = buildProblemTemplate(platformKey, payload.slug);

  return {
    ...template,
    ...existingProblem,
    platform: platformKey,
    slug: payload.slug,
    title: payload.title || existingProblem.title || template.title,
    difficulty: payload.difficulty || existingProblem.difficulty || template.difficulty,
    url: payload.url || existingProblem.url || template.url,
    tags: Array.isArray(payload.tags) ? payload.tags : (existingProblem.tags ?? []),
    solvedAt: payload.acceptedAt || existingProblem.solvedAt || null,
    source: existingProblem.source || "browser-extension"
  };
}

function validateCapturePayload(payload) {
  const required = ["platform", "slug", "title", "difficulty", "url", "language", "code", "acceptedAt"];

  for (const key of required) {
    if (!payload?.[key]) {
      throw new Error(`Missing required field: ${key}`);
    }
  }
}

export async function captureSolution(payload, options = {}) {
  validateCapturePayload(payload);

  const rootDir = resolveRootDir(options);
  const platformKey = normalizePlatform(payload.platform);

  if (!platformKey) {
    throw new Error(`Unsupported platform: ${payload.platform}`);
  }

  const slug = slugify(payload.slug);
  const languageInfo = getLanguageFileInfo(payload.language);

  if (!languageInfo) {
    throw new Error(`Unsupported language: ${payload.language}`);
  }

  await ensureBaseStructure(rootDir);
  const problemDir = getProblemDirectory(rootDir, platformKey, slug);
  const problemJsonPath = path.join(problemDir, "problem.json");
  const solutionPath = path.join(problemDir, SOLUTIONS_DIRECTORY, languageInfo.filename);
  const solutionRelativePath = path.join(SOLUTIONS_DIRECTORY, languageInfo.filename).replaceAll("\\", "/");
  const isNewProblem = !(await exists(problemJsonPath));

  let existingProblem = {};
  if (!isNewProblem) {
    existingProblem = await readJson(problemJsonPath);
  }

  if (!options.force && (await exists(solutionPath))) {
    throw new Error(`Solution already exists: ${solutionRelativePath}`);
  }

  const problemData = buildProblemData(
    platformKey,
    {
      ...payload,
      slug
    },
    existingProblem
  );

  await upsertProblemJson(rootDir, platformKey, slug, {
    ...problemData,
    submissions: [
      createSubmissionRecord({
        language: languageInfo.language,
        submittedAt: payload.acceptedAt,
        source: "browser-extension",
        codeAvailable: true,
        filename: solutionRelativePath
      })
    ]
  });

  await writeTextFile(solutionPath, payload.code, { force: true });
  await writeTextFile(path.join(problemDir, "tests.json"), `${JSON.stringify({ tests: [] }, null, 2)}\n`, {
    force: false
  });
  await writeTextFile(
    path.join(problemDir, "explanation.md"),
    `# ${problemData.title}\n\n## Approach\n\nAdd explanation after reviewing the accepted solution.\n`,
    { force: false }
  );

  let autoExplanation = null;
  if (isNewProblem && (await shouldAutoExplainProblem(platformKey, slug, { rootDir }))) {
    const explainWithAI = options.explainWithAI ?? explainProblemWithAI;
    autoExplanation = await explainWithAI(platformKey, slug, {
      rootDir,
      force: true
    });
  }

  const syncRunner = options.syncRunner ?? runSync;
  const syncResult = await syncRunner({ rootDir });

  return {
    ok: true,
    message: `Captured ${platformKey}/${slug} ${languageInfo.language} solution`,
    path: path.relative(rootDir, problemDir),
    sync: syncResult.summary,
    explanationGenerated: autoExplanation?.written === true
  };
}
