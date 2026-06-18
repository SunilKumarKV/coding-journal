import path from "node:path";
import { fetchPublicProjects } from "./github-projects-sync.js";
import { publishJournalData } from "./publish-journal.js";
import { resolvePaths, resolveRootDir, writeJson } from "./journal.js";

export async function buildData(options = {}) {
  const rootDir = resolveRootDir(options);
  const { dataDir } = resolvePaths({ rootDir });
  const [journal, projects] = await Promise.all([
    publishJournalData({ rootDir }),
    fetchPublicProjects({ rootDir, fetchImpl: options.fetchImpl })
  ]);

  const stats = {
    ...journal.stats,
    totalProjects: projects.length
  };

  const metadata = {
    ...journal.metadata,
    counts: {
      ...journal.metadata.counts,
      projects: projects.length
    }
  };

  await Promise.all([
    writeJson(path.join(dataDir, "projects.json"), projects),
    writeJson(path.join(dataDir, "stats.json"), stats),
    writeJson(path.join(dataDir, "metadata.json"), metadata)
  ]);

  return {
    problems: journal.problems,
    projects,
    stats,
    metadata
  };
}
