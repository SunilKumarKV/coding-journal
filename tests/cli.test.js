import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve("bin/cj.js");

async function runCli(args, rootDir) {
  return execFileAsync(process.execPath, [CLI_PATH, "--root", rootDir, ...args], {
    cwd: path.resolve(".")
  });
}

async function createWorkspace() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "cj-cli-"));
  await Promise.all([
    mkdir(path.join(rootDir, "problems"), { recursive: true }),
    mkdir(path.join(rootDir, "data"), { recursive: true }),
    mkdir(path.join(rootDir, ".cache"), { recursive: true })
  ]);
  return rootDir;
}

test("cj add creates starter files", async () => {
  const rootDir = await createWorkspace();
  await runCli(["add", "leetcode", "sample-problem"], rootDir);

  const problemJson = JSON.parse(
    await readFile(path.join(rootDir, "problems", "leetcode", "sample-problem", "problem.json"), "utf8")
  );

  assert.equal(problemJson.slug, "sample-problem");
  assert.equal(problemJson.platform, "LeetCode");
  assert.equal(problemJson.verified, false);
});

test("cj verify, publish, and stats work end to end", async () => {
  const rootDir = await createWorkspace();
  await runCli(["add", "leetcode", "two-sum"], rootDir);

  await writeFile(
    path.join(rootDir, "problems", "leetcode", "two-sum", "problem.json"),
    `${JSON.stringify(
      {
        title: "Two Sum",
        slug: "two-sum",
        platform: "LeetCode",
        difficulty: "Easy",
        url: "https://leetcode.com/problems/two-sum/",
        status: "Solved",
        language: "JavaScript",
        tags: ["Array", "Hash Map"],
        timeComplexity: "O(n)",
        spaceComplexity: "O(n)",
        verified: false
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(rootDir, "problems", "leetcode", "two-sum", "solution.js"),
    'export default function solve(nums, target) { const seen = new Map(); for (let i = 0; i < nums.length; i += 1) { const complement = target - nums[i]; if (seen.has(complement)) { return [seen.get(complement), i]; } seen.set(nums[i], i); } return []; }\n',
    "utf8"
  );
  await writeFile(
    path.join(rootDir, "problems", "leetcode", "two-sum", "tests.json"),
    `${JSON.stringify(
      {
        tests: [
          { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
          { input: [[3, 2, 4], 6], expected: [1, 2] }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(rootDir, "problems", "leetcode", "two-sum", "explanation.md"),
    "# Two Sum\n\n## Approach\n\nUse a hash map.\n",
    "utf8"
  );

  const verify = await runCli(["verify"], rootDir);
  assert.match(verify.stdout, /Validated 1 problem\(s\); 1 verified\./);

  const updatedProblem = JSON.parse(
    await readFile(path.join(rootDir, "problems", "leetcode", "two-sum", "problem.json"), "utf8")
  );
  assert.equal(updatedProblem.verified, true);

  const publish = await runCli(["publish"], rootDir);
  assert.match(publish.stdout, /Published 1 problem\(s\)\./);

  const generatedProblems = JSON.parse(await readFile(path.join(rootDir, "data", "problems.json"), "utf8"));
  const generatedStats = JSON.parse(await readFile(path.join(rootDir, "data", "stats.json"), "utf8"));

  assert.equal(generatedProblems.length, 1);
  assert.equal(generatedProblems[0].verified, true);
  assert.equal(generatedStats.totalProblems, 1);
  assert.equal(generatedStats.verifiedProblems, 1);
  assert.equal(generatedStats.byLanguage.JavaScript, 1);

  const stats = await runCli(["stats"], rootDir);
  assert.match(stats.stdout, /Total problems: 1/);
  assert.match(stats.stdout, /Verified problems: 1/);
  assert.match(stats.stdout, /Language counts:/);
});
