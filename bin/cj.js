#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { JAVASCRIPT_SOLUTION_FILENAME, PLATFORM_CONFIG, SOLUTIONS_DIRECTORY } from "../lib/constants.js";
import {
  buildExplanationTemplate,
  buildProblemTemplate,
  buildSolutionTemplate,
  buildTestsTemplate,
  ensureBaseStructure,
  exists,
  normalizePlatform,
  resolveRootDir,
  slugToTitle,
  writeJson
} from "../lib/journal.js";
import { publishJournalData } from "../lib/publish-journal.js";
import { validateProblems } from "../lib/validate-problems.js";

const program = new Command();

function getCommandRoot(command) {
  return resolveRootDir({ rootDir: program.opts().root });
}

program
  .name("cj")
  .description("Manage solved coding problems for coding-journal")
  .option("--root <path>", "root directory for the journal workspace");

program
  .command("add")
  .argument("<platform>", "platform key such as leetcode or hackerrank")
  .argument("<slug>", "problem slug")
  .description("Create a new problem folder with starter files")
  .action(async (platformInput, slug, command) => {
    const rootDir = getCommandRoot(command);
    const platformKey = normalizePlatform(platformInput);

    if (!platformKey) {
      console.error(`Unsupported platform: ${platformInput}`);
      console.error(`Supported platforms: ${Object.keys(PLATFORM_CONFIG).join(", ")}`);
      process.exitCode = 1;
      return;
    }

    await ensureBaseStructure(rootDir);
    const platform = PLATFORM_CONFIG[platformKey];
    const problemDir = path.join(rootDir, "problems", platform.directory, slug);

    if (await exists(problemDir)) {
      console.error(`Problem already exists: ${problemDir}`);
      process.exitCode = 1;
      return;
    }

    await mkdir(problemDir, { recursive: true });
    await mkdir(path.join(problemDir, SOLUTIONS_DIRECTORY), { recursive: true });
    await Promise.all([
      writeJson(path.join(problemDir, "problem.json"), buildProblemTemplate(platformKey, slug)),
      writeFile(
        path.join(problemDir, SOLUTIONS_DIRECTORY, JAVASCRIPT_SOLUTION_FILENAME),
        buildSolutionTemplate(slug),
        "utf8"
      ),
      writeFile(path.join(problemDir, "tests.json"), buildTestsTemplate(), "utf8"),
      writeFile(path.join(problemDir, "explanation.md"), buildExplanationTemplate(slugToTitle(slug)), "utf8")
    ]);

    console.log(`Created ${path.relative(rootDir, problemDir)}`);
  });

program
  .command("verify")
  .description("Run tests for all complete problems and persist verification status")
  .action(async (command) => {
    const rootDir = getCommandRoot(command);
    const summary = await validateProblems({ rootDir });
    console.log(`Validated ${summary.totalChecked} problem(s); ${summary.totalVerified} verified.`);
  });

program
  .command("publish")
  .description("Generate data/problems.json, data/stats.json, and data/metadata.json")
  .action(async (command) => {
    const rootDir = getCommandRoot(command);
    const result = await publishJournalData({ rootDir });
    console.log(`Published ${result.problems.length} problem(s).`);
  });

program
  .command("stats")
  .description("Show journal statistics")
  .action(async (command) => {
    const rootDir = getCommandRoot(command);
    const result = await publishJournalData({ rootDir });

    console.log(`Total problems: ${result.stats.totalProblems}`);
    console.log(`Verified problems: ${result.stats.verifiedProblems}`);
    console.log(`Platform counts: ${JSON.stringify(result.stats.byPlatform)}`);
    console.log(`Language counts: ${JSON.stringify(result.stats.byLanguage)}`);
  });

program.parseAsync(process.argv);
