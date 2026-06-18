import { buildData } from "./build-data.js";
import { validateProblems } from "./validate-problems.js";

export async function runSync(options = {}) {
  const validation = await validateProblems(options);
  const build = await buildData(options);

  return {
    validation,
    build,
    summary: {
      totalProblems: build.stats.totalProblems,
      verifiedProblems: build.stats.verifiedProblems,
      unverifiedProblems: build.stats.totalProblems - build.stats.verifiedProblems,
      platforms: Object.keys(build.stats.byPlatform),
      languages: Object.keys(build.stats.byLanguage),
      generatedFiles: [
        "data/problems.json",
        "data/projects.json",
        "data/stats.json",
        "data/metadata.json"
      ]
    }
  };
}
