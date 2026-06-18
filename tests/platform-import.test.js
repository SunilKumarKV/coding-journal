import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { explainProblem } from "../lib/explain-problem.js";
import { importSingleProblem } from "../lib/import-problems.js";
import {
  normalizeProblem as normalizeCodeforcesProblem,
  parseCodeforcesProblemIdentifier
} from "../lib/platforms/codeforces.js";
import {
  normalizeProblem as normalizeLeetCodeProblem,
  parseLeetCodeSlug
} from "../lib/platforms/leetcode.js";

async function createWorkspace() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "cj-import-"));
  await Promise.all([
    mkdir(path.join(rootDir, "problems"), { recursive: true }),
    mkdir(path.join(rootDir, "data"), { recursive: true }),
    mkdir(path.join(rootDir, ".cache"), { recursive: true })
  ]);
  return rootDir;
}

function createFetchStub(responseData) {
  return async () => ({
    ok: true,
    async json() {
      return { data: responseData };
    }
  });
}

test("LeetCode slug parsing supports full URLs and plain slugs", () => {
  assert.equal(parseLeetCodeSlug("https://leetcode.com/problems/add-two-numbers/"), "add-two-numbers");
  assert.equal(parseLeetCodeSlug("add-two-numbers"), "add-two-numbers");
});

test("Codeforces slug parsing supports URLs and generated slugs", () => {
  assert.deepEqual(parseCodeforcesProblemIdentifier("https://codeforces.com/problemset/problem/4/A"), {
    contestId: 4,
    index: "A"
  });
  assert.deepEqual(parseCodeforcesProblemIdentifier("4-a-watermelon"), {
    contestId: 4,
    index: "A"
  });
});

test("LeetCode normalized shape is stable", () => {
  assert.deepEqual(
    normalizeLeetCodeProblem({
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/",
      tags: ["Array"],
      solvedAt: "2026-06-18T00:00:00.000Z",
      source: "test"
    }),
    {
      platform: "LeetCode",
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/",
      tags: ["Array"],
      solvedAt: "2026-06-18T00:00:00.000Z",
      source: "test"
    }
  );
});

test("Codeforces normalized shape is stable", () => {
  assert.deepEqual(
    normalizeCodeforcesProblem({
      slug: "4-a-watermelon",
      title: "Watermelon",
      difficulty: "Rating 800",
      url: "https://codeforces.com/problemset/problem/4/A",
      tags: ["brute force"],
      solvedAt: "2026-06-18T00:00:00.000Z",
      source: "test"
    }),
    {
      platform: "Codeforces",
      slug: "4-a-watermelon",
      title: "Watermelon",
      difficulty: "Rating 800",
      url: "https://codeforces.com/problemset/problem/4/A",
      tags: ["brute force"],
      solvedAt: "2026-06-18T00:00:00.000Z",
      source: "test"
    }
  );
});

test("import-problem creates multi-language templates without overwriting by default", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createFetchStub({
    question: {
      title: "Add Two Numbers",
      titleSlug: "add-two-numbers",
      difficulty: "Medium",
      topicTags: [{ name: "Linked List" }, { name: "Math" }]
    }
  });

  await importSingleProblem("leetcode", "add-two-numbers", { rootDir, fetchImpl });

  const problemDir = path.join(rootDir, "problems", "leetcode", "add-two-numbers");
  const files = [
    "problem.json",
    "explanation.md",
    "tests.json",
    "solutions/javascript.js",
    "solutions/java.java",
    "solutions/c.c"
  ];

  for (const file of files) {
    const content = await readFile(path.join(problemDir, file), "utf8");
    assert.ok(content.length > 0);
  }

  const customExplanation = "custom explanation";
  await writeFile(path.join(problemDir, "explanation.md"), customExplanation, "utf8");
  await importSingleProblem("leetcode", "add-two-numbers", { rootDir, fetchImpl });

  const explanationAfterSecondImport = await readFile(path.join(problemDir, "explanation.md"), "utf8");
  assert.equal(explanationAfterSecondImport, customExplanation);
});

test("explain command does not overwrite unless force", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createFetchStub({
    question: {
      title: "Palindrome Number",
      titleSlug: "palindrome-number",
      difficulty: "Easy",
      topicTags: [{ name: "Math" }]
    }
  });

  await importSingleProblem("leetcode", "palindrome-number", { rootDir, fetchImpl, force: true });
  const problemDir = path.join(rootDir, "problems", "leetcode", "palindrome-number");

  await writeFile(path.join(problemDir, "tests.json"), `${JSON.stringify({ tests: [{ input: [121], expected: true }] }, null, 2)}\n`, "utf8");
  await writeFile(path.join(problemDir, "explanation.md"), "existing explanation", "utf8");

  const firstAttempt = await explainProblem("leetcode", "palindrome-number", { rootDir });
  assert.equal(firstAttempt.written, false);

  const secondAttempt = await explainProblem("leetcode", "palindrome-number", { rootDir, force: true });
  assert.equal(secondAttempt.written, true);

  const explanation = await readFile(path.join(problemDir, "explanation.md"), "utf8");
  assert.match(explanation, /# Palindrome Number/);
  assert.match(explanation, /## Key Learning/);
});
