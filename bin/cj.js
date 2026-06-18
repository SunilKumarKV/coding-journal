#!/usr/bin/env node

import { Command } from "commander";
import { DEFAULT_SOLUTION_TEMPLATES, PLATFORM_CONFIG } from "../lib/constants.js";
import {
  createProblemScaffold,
  buildProblemTemplate,
  normalizePlatform,
  resolveRootDir,
  slugify
} from "../lib/journal.js";
import { explainProblem } from "../lib/explain-problem.js";
import { importSingleProblem, importSubmission, pullPlatformProblems } from "../lib/import-problems.js";
import { publishJournalData } from "../lib/publish-journal.js";
import { runSync } from "../lib/run-sync.js";
import { formatValidationSummary, validateProblems } from "../lib/validate-problems.js";

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

    const result = await createProblemScaffold(rootDir, platformKey, slugify(slug), buildProblemTemplate(platformKey, slugify(slug)), {
      solutionFilenames: ["javascript.js"]
    });
    console.log(`Created ${result.problemDir.replace(`${rootDir}/`, "")}`);
  });

program
  .command("pull")
  .argument("<platform>", "platform key such as leetcode or codeforces")
  .argument("<username>", "public username or handle")
  .option("--force", "overwrite existing generated files", false)
  .description("Pull accepted-submission metadata from a public coding platform profile")
  .action(async (platformInput, username, options, command) => {
    const rootDir = getCommandRoot(command);
    const result = await pullPlatformProblems(platformInput, username, {
      rootDir,
      force: options.force
    });

    console.log(`Fetched ${result.totalFetched} public solved problem(s).`);
    console.log(`Created or updated ${result.importedCount} problem folder(s).`);

    if (result.skipped.length > 0) {
      console.log(`Metadata merged into existing folders: ${result.skipped.length}`);
    }

    if (result.warning) {
      console.warn(result.warning);
    }
  });

program
  .command("import")
  .argument("<platform>", "platform key such as leetcode or codeforces")
  .argument("<username>", "public username or handle")
  .option("--force", "overwrite existing generated files", false)
  .description("Alias for cj pull")
  .action(async (platformInput, username, options, command) => {
    const rootDir = getCommandRoot(command);
    const result = await pullPlatformProblems(platformInput, username, {
      rootDir,
      force: options.force
    });

    console.log(`Fetched ${result.totalFetched} public solved problem(s).`);
    console.log(`Created or updated ${result.importedCount} problem folder(s).`);

    if (result.skipped.length > 0) {
      console.log(`Metadata merged into existing folders: ${result.skipped.length}`);
    }

    if (result.warning) {
      console.warn(result.warning);
    }
  });

program
  .command("import-problem")
  .argument("<platform>", "platform key such as leetcode or codeforces")
  .argument("<slug-or-url>", "problem slug or full URL")
  .option("--force", "overwrite existing generated files", false)
  .description("Import a single problem and create solution/explanation templates")
  .action(async (platformInput, slugOrUrl, options, command) => {
    const rootDir = getCommandRoot(command);
    const result = await importSingleProblem(platformInput, slugOrUrl, {
      rootDir,
      force: options.force
    });

    console.log(`Prepared ${result.problemDir.replace(`${rootDir}/`, "")}`);
    console.log(`Created files: ${result.created.length}`);

    if (result.skipped.length > 0) {
      console.log(`Skipped existing files: ${result.skipped.length}`);
    }
  });

program
  .command("import-submission")
  .argument("<platform>", "platform key")
  .argument("<slug>", "problem slug")
  .requiredOption("--language <language>", "submission language")
  .requiredOption("--file <path>", "path to the accepted submission source file")
  .option("--force", "overwrite an existing solution file", false)
  .description("Attach a real accepted submission file to an existing problem")
  .action(async (platformInput, slug, options, command) => {
    const rootDir = getCommandRoot(command);
    const result = await importSubmission(platformInput, slug, {
      rootDir,
      language: options.language,
      file: options.file,
      force: options.force
    });

    console.log(`Imported submission to ${result.destinationPath.replace(`${rootDir}/`, "")}`);
    console.log(`Recorded ${result.submission.language} submission for ${slug}`);
  });

program
  .command("explain")
  .argument("<platform>", "platform key")
  .argument("<slug>", "problem slug")
  .option("--force", "overwrite existing explanation.md", false)
  .description("Generate a deterministic explanation.md from problem files")
  .action(async (platformInput, slug, options, command) => {
    const rootDir = getCommandRoot(command);
    const result = await explainProblem(platformInput, slug, {
      rootDir,
      force: options.force
    });

    if (!result.written) {
      console.warn(result.reason);
      return;
    }

    console.log(`Generated ${result.explanationPath.replace(`${rootDir}/`, "")}`);
  });

program
  .command("verify")
  .description("Run tests for all complete problems and persist verification status")
  .action(async (command) => {
    const rootDir = getCommandRoot(command);
    const summary = await validateProblems({ rootDir });
    console.log(formatValidationSummary(summary));
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

program
  .command("sync")
  .description("Run validation and build, then print a concise sync summary")
  .action(async (command) => {
    const rootDir = getCommandRoot(command);
    const result = await runSync({ rootDir });

    console.log(`Total problems: ${result.summary.totalProblems}`);
    console.log(`Verified problems: ${result.summary.verifiedProblems}`);
    console.log(`Unverified problems: ${result.summary.unverifiedProblems}`);
    console.log(`Problems missing code: ${result.summary.problemsMissingCode}`);
    console.log("Unverified problems:");
    if (result.summary.unverifiedDetails.length === 0) {
      console.log("- none");
    } else {
      for (const item of result.summary.unverifiedDetails) {
        console.log(`- ${item.platform}/${item.slug} — ${item.reason}`);
      }
    }
    console.log(`Platforms: ${result.summary.platforms.join(", ")}`);
    console.log(`Languages: ${result.summary.languages.join(", ")}`);
    console.log(`Generated data files: ${result.summary.generatedFiles.join(", ")}`);
  });

program.parseAsync(process.argv);
