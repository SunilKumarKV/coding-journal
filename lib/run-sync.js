import { buildData } from "./build-data.js";
import { normalizeAllProblemJsonPlatforms, resolveRootDir } from "./journal.js";
import { validateProblems } from "./validate-problems.js";

export async function runSync(options = {}) {
  const rootDir = resolveRootDir(options);
  await normalizeAllProblemJsonPlatforms(rootDir);
  const validation = await validateProblems(options);
  const build = await buildData(options);
  const unverifiedDetails = validation.results
    .filter((result) => !result.verified)
    .map((result) => ({
      platform: result.platform,
      slug: result.slug,
      reason: result.reason
    }));

  return {
    validation,
    build,
    summary: {
      totalProblems: build.stats.totalProblems,
      verifiedProblems: build.stats.verifiedProblems,
      unverifiedProblems: build.stats.totalProblems - build.stats.verifiedProblems,
      problemsMissingCode: build.stats.problemsMissingCode ?? 0,
      platforms: Object.keys(build.stats.byPlatform),
      languages: Object.keys(build.stats.byLanguage),
      unverifiedDetails,
      generatedFiles: [
        "data/problems.json",
        "data/projects.json",
        "data/stats.json",
        "data/metadata.json"
      ]
    }
  };
}
