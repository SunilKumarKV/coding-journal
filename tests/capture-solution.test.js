import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureSolution } from "../lib/capture-solution.js";

async function createWorkspace() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "cj-capture-"));
  await Promise.all([
    mkdir(path.join(rootDir, "problems"), { recursive: true }),
    mkdir(path.join(rootDir, "data"), { recursive: true }),
    mkdir(path.join(rootDir, ".cache"), { recursive: true })
  ]);
  return rootDir;
}

test("captureSolution creates problem files and stores real code", async () => {
  const rootDir = await createWorkspace();
  const result = await captureSolution(
    {
      platform: "leetcode",
      slug: "add-two-numbers",
      title: "Add Two Numbers",
      difficulty: "Medium",
      url: "https://leetcode.com/problems/add-two-numbers/",
      tags: ["Linked List", "Math"],
      language: "JavaScript",
      code: "export default function solve() { return null; }\n",
      acceptedAt: "2026-06-16T10:00:00.000Z"
    },
    { rootDir }
  );

  assert.equal(result.ok, true);
  assert.equal(result.path, "problems/leetcode/add-two-numbers");

  const problem = JSON.parse(
    await readFile(path.join(rootDir, "problems", "leetcode", "add-two-numbers", "problem.json"), "utf8")
  );
  assert.equal(problem.platform, "leetcode");
  assert.equal(problem.submissions.length, 1);
  assert.equal(problem.submissions[0].source, "browser-extension");
  assert.equal(problem.submissions[0].codeAvailable, true);

  const code = await readFile(
    path.join(rootDir, "problems", "leetcode", "add-two-numbers", "solutions", "javascript.js"),
    "utf8"
  );
  assert.match(code, /export default function solve/);

  const testsJson = JSON.parse(
    await readFile(path.join(rootDir, "problems", "leetcode", "add-two-numbers", "tests.json"), "utf8")
  );
  assert.deepEqual(testsJson, { tests: [] });
});

test("captureSolution does not overwrite an existing real solution file", async () => {
  const rootDir = await createWorkspace();
  await captureSolution(
    {
      platform: "leetcode",
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/",
      tags: ["Array", "Hash Map"],
      language: "JavaScript",
      code: "export default function solve() { return [0, 1]; }\n",
      acceptedAt: "2026-06-16T10:00:00.000Z"
    },
    { rootDir }
  );

  await assert.rejects(
    captureSolution(
      {
        platform: "leetcode",
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "Easy",
        url: "https://leetcode.com/problems/two-sum/",
        tags: ["Array", "Hash Map"],
        language: "JavaScript",
        code: "export default function solve() { return []; }\n",
        acceptedAt: "2026-06-16T10:05:00.000Z"
      },
      { rootDir }
    ),
    /Solution already exists/
  );
});
