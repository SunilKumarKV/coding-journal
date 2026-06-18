import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildReleasePrDescription,
  buildReleasePrTitle,
  collectReleaseChanges,
  prepareRelease,
  renderReleaseMarkdown
} from "../lib/release.js";

async function createWorkspace() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "cj-release-"));
  await Promise.all([
    mkdir(path.join(rootDir, "data"), { recursive: true }),
    mkdir(path.join(rootDir, "docs", "releases"), { recursive: true })
  ]);
  return rootDir;
}

test("collectReleaseChanges detects new problems, languages, and recent activity", () => {
  const before = [
    {
      title: "Two Sum",
      slug: "two-sum",
      platform: "LeetCode",
      solvedAt: "2026-06-10T10:00:00.000Z",
      solutions: [{ language: "JavaScript" }]
    }
  ];

  const after = [
    ...before,
    {
      title: "Longest Common Prefix",
      slug: "longest-common-prefix",
      platform: "LeetCode",
      solvedAt: "2026-06-18T10:00:00.000Z",
      solutions: [{ language: "JavaScript" }, { language: "Java" }, { language: "C" }]
    }
  ];

  const changes = collectReleaseChanges(before, after);

  assert.equal(changes.newProblems.length, 1);
  assert.equal(changes.newProblems[0].title, "Longest Common Prefix");
  assert.deepEqual(changes.newLanguages, ["C", "Java"]);
  assert.equal(changes.recentActivity[0].title, "Longest Common Prefix");
});

test("renderReleaseMarkdown and PR helpers include release sections", () => {
  const summary = {
    changes: {
      newProblems: [{ title: "Two Sum", platform: "LeetCode", solvedAt: "2026-06-18T10:00:00.000Z" }],
      newLanguages: ["JavaScript", "Java"],
      recentActivity: [{ title: "Two Sum", platform: "LeetCode", solvedAt: "2026-06-18T10:00:00.000Z" }]
    },
    stats: {
      totalProblems: 2,
      verifiedProblems: 1,
      byPlatform: { LeetCode: 2 },
      byLanguage: { Java: 1, JavaScript: 2 }
    }
  };

  const markdown = renderReleaseMarkdown(summary);
  const prTitle = buildReleasePrTitle();
  const prDescription = buildReleasePrDescription(summary);

  assert.match(markdown, /# Coding Journal Update/);
  assert.match(markdown, /## New Problems/);
  assert.match(markdown, /## Languages Added/);
  assert.match(markdown, /## Stats/);
  assert.match(markdown, /## Recent Activity/);
  assert.equal(prTitle, "feat: sync coding journal progress");
  assert.match(prDescription, /## Summary/);
  assert.match(prDescription, /Languages Added/);
});

test("prepareRelease writes docs/releases/latest.md and prints PR details from sync results", async () => {
  const rootDir = await createWorkspace();

  await writeFile(
    path.join(rootDir, "data", "problems.json"),
    `${JSON.stringify(
      [
        {
          title: "Two Sum",
          slug: "two-sum",
          platform: "LeetCode",
          solvedAt: "2026-06-10T10:00:00.000Z",
          solutions: [{ language: "JavaScript" }]
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = await prepareRelease({
    rootDir,
    syncRunner: async () => {
      await writeFile(
        path.join(rootDir, "data", "problems.json"),
        `${JSON.stringify(
          [
            {
              title: "Two Sum",
              slug: "two-sum",
              platform: "LeetCode",
              solvedAt: "2026-06-10T10:00:00.000Z",
              solutions: [{ language: "JavaScript" }]
            },
            {
              title: "Longest Common Prefix",
              slug: "longest-common-prefix",
              platform: "LeetCode",
              solvedAt: "2026-06-18T10:00:00.000Z",
              solutions: [{ language: "JavaScript" }, { language: "Java" }]
            }
          ],
          null,
          2
        )}\n`,
        "utf8"
      );

      await writeFile(
        path.join(rootDir, "data", "stats.json"),
        `${JSON.stringify(
          {
            totalProblems: 2,
            verifiedProblems: 1,
            byPlatform: { LeetCode: 2 },
            byLanguage: { Java: 1, JavaScript: 2 }
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      return {
        summary: {
          totalProblems: 2,
          verifiedProblems: 1
        }
      };
    }
  });

  const markdown = await readFile(path.join(rootDir, "docs", "releases", "latest.md"), "utf8");

  assert.match(markdown, /Longest Common Prefix/);
  assert.match(markdown, /Java/);
  assert.equal(result.prTitle, "feat: sync coding journal progress");
  assert.match(result.prDescription, /Added Longest Common Prefix/);
});
