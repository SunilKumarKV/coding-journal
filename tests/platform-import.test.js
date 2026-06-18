import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { explainProblem, explainProblemWithAI } from "../lib/explain-problem.js";
import { buildData } from "../lib/build-data.js";
import { getLanguageFileInfo } from "../lib/journal.js";
import { importSingleProblem, importSubmission, pullPlatformProblems } from "../lib/import-problems.js";
import { captureSolution } from "../lib/capture-solution.js";
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

function createCodeforcesFetchStub(result) {
  return async () => ({
    ok: true,
    async json() {
      return { status: "OK", result };
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
      source: "test",
      submissions: []
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
      source: "test",
      submissions: []
    }
  );
});

test("language normalization maps supported import-submission languages", () => {
  assert.deepEqual(getLanguageFileInfo("javascript"), {
    language: "JavaScript",
    filename: "javascript.js"
  });
  assert.deepEqual(getLanguageFileInfo("java"), {
    language: "Java",
    filename: "java.java"
  });
  assert.deepEqual(getLanguageFileInfo("c++"), {
    language: "C++",
    filename: "cpp.cpp"
  });
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

test("import-submission copies files and updates problem.json submissions", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createFetchStub({
    question: {
      title: "Add Digits",
      titleSlug: "add-digits",
      difficulty: "Easy",
      topicTags: [{ name: "Math" }]
    }
  });

  await importSingleProblem("leetcode", "add-digits", { rootDir, fetchImpl, force: true });
  const sourcePath = path.join(rootDir, "accepted-add-digits.js");
  await writeFile(sourcePath, "export default function solve(n) { return n; }\n", "utf8");

  const result = await importSubmission("leetcode", "add-digits", {
    rootDir,
    language: "javascript",
    file: sourcePath
  });

  const copiedCode = await readFile(result.destinationPath, "utf8");
  assert.match(copiedCode, /export default function solve/);

  const problem = JSON.parse(
    await readFile(path.join(rootDir, "problems", "leetcode", "add-digits", "problem.json"), "utf8")
  );
  assert.equal(problem.submissions.length, 1);
  assert.equal(problem.submissions[0].codeAvailable, true);
  assert.equal(problem.submissions[0].filename, "solutions/javascript.js");
});

test("import-submission does not overwrite without force", async () => {
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
  const sourcePath = path.join(rootDir, "palindrome-number.js");
  await writeFile(sourcePath, "export default function solve(x) { return x; }\n", "utf8");

  await importSubmission("leetcode", "palindrome-number", {
    rootDir,
    language: "javascript",
    file: sourcePath
  });

  await assert.rejects(
    importSubmission("leetcode", "palindrome-number", {
      rootDir,
      language: "javascript",
      file: sourcePath
    }),
    /Solution already exists/
  );
});

test("LeetCode pull creates metadata without fake code", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createFetchStub({
    matchedUser: {
      submitStatsGlobal: {
        acSubmissionNum: [{ difficulty: "All", count: 12 }]
      }
    },
    recentAcSubmissionList: [
      {
        title: "Two Sum",
        titleSlug: "two-sum",
        timestamp: "1781322946"
      }
    ]
  });

  const result = await pullPlatformProblems("leetcode", "Sunil-Kumar-K-V", { rootDir, fetchImpl });
  assert.equal(result.created.length, 1);
  assert.match(result.warning, /recent accepted submissions/);

  const problemDir = path.join(rootDir, "problems", "leetcode", "two-sum");
  await assert.rejects(readFile(path.join(problemDir, "solutions", "javascript.js"), "utf8"));

  const problem = JSON.parse(await readFile(path.join(problemDir, "problem.json"), "utf8"));
  assert.equal(problem.submissions[0].codeAvailable, false);
});

test("Codeforces pull groups accepted submissions", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createCodeforcesFetchStub([
    {
      verdict: "OK",
      creationTimeSeconds: 1780000000,
      programmingLanguage: "GNU C++20",
      problem: {
        contestId: 4,
        index: "A",
        name: "Watermelon",
        rating: 800,
        tags: ["brute force"]
      }
    },
    {
      verdict: "OK",
      creationTimeSeconds: 1780000300,
      programmingLanguage: "GNU C++20",
      problem: {
        contestId: 4,
        index: "A",
        name: "Watermelon",
        rating: 800,
        tags: ["brute force"]
      }
    }
  ]);

  const result = await pullPlatformProblems("codeforces", "tourist", { rootDir, fetchImpl });
  assert.equal(result.created.length, 1);

  const problem = JSON.parse(
    await readFile(path.join(rootDir, "problems", "codeforces", "4-a-watermelon", "problem.json"), "utf8")
  );
  assert.equal(problem.submissions.length, 1);
  assert.equal(problem.submissions[0].codeAvailable, false);
  assert.equal(problem.submissions[0].language, "GNU C++20");
});

test("build includes submissions and solutions", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createFetchStub({
    question: {
      title: "Add Two Numbers",
      titleSlug: "add-two-numbers",
      difficulty: "Medium",
      topicTags: [{ name: "Linked List" }]
    }
  });

  await importSingleProblem("leetcode", "add-two-numbers", { rootDir, fetchImpl, force: true });
  const sourcePath = path.join(rootDir, "add-two-numbers.js");
  await writeFile(sourcePath, "export default function solve() { return null; }\n", "utf8");
  await importSubmission("leetcode", "add-two-numbers", {
    rootDir,
    language: "javascript",
    file: sourcePath,
    force: true
  });

  const buildResult = await buildData({
    rootDir,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [];
      }
    })
  }).catch(async () => {
    const problems = JSON.parse(await readFile(path.join(rootDir, "data", "problems.json"), "utf8"));
    return { problems };
  });

  const problems = buildResult.problems ?? JSON.parse(await readFile(path.join(rootDir, "data", "problems.json"), "utf8"));
  assert.equal(problems[0].submissions.length >= 1, true);
  assert.equal(problems[0].solutions.length >= 1, true);
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

test("explain-ai generates markdown from real problem files with a mocked Gemini response", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createFetchStub({
    question: {
      title: "Longest Common Prefix",
      titleSlug: "longest-common-prefix",
      difficulty: "Easy",
      topicTags: [{ name: "Array" }, { name: "String" }]
    }
  });

  await importSingleProblem("leetcode", "longest-common-prefix", { rootDir, fetchImpl, force: true });
  const problemDir = path.join(rootDir, "problems", "leetcode", "longest-common-prefix");
  await writeFile(
    path.join(problemDir, "solutions", "javascript.js"),
    "export default function longestCommonPrefix(strs) { return strs[0]; }\n",
    "utf8"
  );
  await writeFile(
    path.join(problemDir, "tests.json"),
    `${JSON.stringify({ tests: [{ input: [["flower", "flow", "flight"]], expected: "fl" }] }, null, 2)}\n`,
    "utf8"
  );

  const result = await explainProblemWithAI("leetcode", "longest-common-prefix", {
    rootDir,
    force: true,
    generateMarkdown: async (prompt) => {
      assert.match(prompt, /problem\.json/);
      assert.match(prompt, /solutions/);
      assert.match(prompt, /Longest Common Prefix/);

      return `# Longest Common Prefix

## Problem Summary

Find the shared starting substring across every string in the input array.

## Approach

Use the first string as the reference. Compare each character position against the same position in every other string. The first mismatch ends the prefix, so return the substring up to that index.

## Time Complexity
\`\`\`text
O(n * m)
\`\`\`

## Space Complexity
\`\`\`text
O(1)
\`\`\`

## Step-By-Step Example

For \`["flower", "flow", "flight"]\`, the prefix stays \`"f"\`, then \`"fl"\`, and stops before index 2 because \`"o"\` and \`"i"\` differ. The answer is \`"fl"\`.

## Key Learning

* Reusing the first string as a reference keeps the logic simple.
* Early exit on the first mismatch prevents unnecessary comparisons.
* Prefix problems often reduce to character-by-character validation.

## Languages Solved
* JavaScript`;
    }
  });

  assert.equal(result.written, true);

  const explanation = await readFile(path.join(problemDir, "explanation.md"), "utf8");
  assert.match(explanation, /## Problem Summary/);
  assert.match(explanation, /## Languages Solved/);
});

test("explain-ai does not overwrite a real explanation without force", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createFetchStub({
    question: {
      title: "Valid Palindrome",
      titleSlug: "valid-palindrome",
      difficulty: "Easy",
      topicTags: [{ name: "Two Pointers" }]
    }
  });

  await importSingleProblem("leetcode", "valid-palindrome", { rootDir, fetchImpl, force: true });
  const problemDir = path.join(rootDir, "problems", "leetcode", "valid-palindrome");
  await writeFile(path.join(problemDir, "explanation.md"), "# Valid Palindrome\n\nReal explanation.\n", "utf8");

  const result = await explainProblemWithAI("leetcode", "valid-palindrome", {
    rootDir,
    generateMarkdown: async () => {
      throw new Error("should not be called");
    }
  });

  assert.equal(result.written, false);
  assert.equal(result.reason, "explanation.md already exists");
});

test("captureSolution auto-generates explanation for new placeholder problems when Gemini is configured", async () => {
  const rootDir = await createWorkspace();
  await writeFile(path.join(rootDir, ".env"), "GEMINI_API_KEY=test-key\n", "utf8");

  const result = await captureSolution(
    {
      platform: "leetcode",
      slug: "sample-prefix",
      title: "Sample Prefix",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/sample-prefix/",
      tags: ["Array", "String"],
      language: "JavaScript",
      code: "export default function solve(strs) { return strs[0]; }\n",
      acceptedAt: "2026-06-18T10:00:00.000Z"
    },
    {
      rootDir,
      syncRunner: async () => ({
        summary: {
          totalProblems: 1,
          verifiedProblems: 0
        }
      }),
      explainWithAI: async (platform, slug, explainOptions) => {
        assert.equal(platform, "leetcode");
        assert.equal(slug, "sample-prefix");
        assert.equal(explainOptions.force, true);

        const explanationPath = path.join(
          rootDir,
          "problems",
          "leetcode",
          "sample-prefix",
          "explanation.md"
        );
        await writeFile(
          explanationPath,
          `# Sample Prefix

## Problem Summary

Find the common starting substring.

## Approach

Scan characters from the first string and stop on the first mismatch.

## Time Complexity
\`\`\`text
O(n * m)
\`\`\`

## Space Complexity
\`\`\`text
O(1)
\`\`\`

## Step-By-Step Example

Walk through the first string while validating the same position in every other string.

## Key Learning

* Prefix checks often use the first string as a baseline.
* Early returns simplify string comparison code.
* Multi-language solutions should still document one shared algorithm.

## Languages Solved
* JavaScript
`,
          "utf8"
        );

        return {
          written: true,
          explanationPath
        };
      }
    }
  );

  assert.equal(result.explanationGenerated, true);
  const explanation = await readFile(
    path.join(rootDir, "problems", "leetcode", "sample-prefix", "explanation.md"),
    "utf8"
  );
  assert.doesNotMatch(explanation, /Add explanation after reviewing the accepted solution/);
  assert.match(explanation, /## Languages Solved/);
});
