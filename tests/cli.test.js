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

  const nestedSolution = await readFile(
    path.join(rootDir, "problems", "leetcode", "sample-problem", "solutions", "javascript.js"),
    "utf8"
  );
  assert.match(nestedSolution, /export default function solve/);
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
    path.join(rootDir, "problems", "leetcode", "two-sum", "solutions", "javascript.js"),
    'export default function solve(nums, target) { const seen = new Map(); for (let i = 0; i < nums.length; i += 1) { const complement = target - nums[i]; if (seen.has(complement)) { return [seen.get(complement), i]; } seen.set(nums[i], i); } return []; }\n',
    "utf8"
  );
  await writeFile(
    path.join(rootDir, "problems", "leetcode", "two-sum", "solutions", "java.java"),
    "class Solution {}\n",
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
  assert.match(generatedProblems[0].explanation, /Use a hash map/);
  assert.equal(generatedProblems[0].solutions.length, 2);
  assert.equal(generatedProblems[0].solutions[0].language, "Java");
  assert.equal(generatedProblems[0].solutions[1].language, "JavaScript");
  assert.equal(generatedStats.totalProblems, 1);
  assert.equal(generatedStats.verifiedProblems, 1);
  assert.equal(generatedStats.byLanguage.JavaScript, 1);

  const stats = await runCli(["stats"], rootDir);
  assert.match(stats.stdout, /Total problems: 1/);
  assert.match(stats.stdout, /Verified problems: 1/);
  assert.match(stats.stdout, /Language counts:/);
});

test("cj verify and cj sync show unverified diagnostics", async () => {
  const rootDir = await createWorkspace();
  await runCli(["add", "leetcode", "broken-problem"], rootDir);

  await writeFile(
    path.join(rootDir, "problems", "leetcode", "broken-problem", "problem.json"),
    `${JSON.stringify(
      {
        title: "Broken Problem",
        slug: "broken-problem",
        platform: "leetcode",
        difficulty: "Easy",
        url: "https://leetcode.com/problems/broken-problem/",
        status: "Solved",
        language: "JavaScript",
        tags: ["Array"],
        timeComplexity: "O(n)",
        spaceComplexity: "O(1)",
        verified: false
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(rootDir, "problems", "leetcode", "broken-problem", "solutions", "javascript.js"),
    "export default function solve() { return 1; }\n",
    "utf8"
  );
  await writeFile(
    path.join(rootDir, "problems", "leetcode", "broken-problem", "tests.json"),
    `${JSON.stringify(
      {
        tests: [{ input: [], expected: 2 }]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(rootDir, "problems", "leetcode", "broken-problem", "explanation.md"),
    "# Broken Problem\n",
    "utf8"
  );

  const verify = await runCli(["verify"], rootDir);
  assert.match(verify.stdout, /\[unverified\]/);
  assert.match(verify.stdout, /platform: leetcode/);
  assert.match(verify.stdout, /slug: broken-problem/);
  assert.match(verify.stdout, /reason: test "example 1" failed/);
  assert.match(verify.stdout, /expected: 2/);
  assert.match(verify.stdout, /received: 1/);

  const sync = await runCli(["sync"], rootDir);
  assert.match(sync.stdout, /Unverified problems:/);
  assert.match(sync.stdout, /- leetcode\/broken-problem — test "example 1" failed/);
});
