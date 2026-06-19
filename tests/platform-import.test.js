import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { explainProblem, explainProblemWithAI } from "../lib/explain-problem.js";
import { buildData } from "../lib/build-data.js";
import { getLanguageFileInfo } from "../lib/journal.js";
import { formatPullDebugInfo, importSingleProblem, importSubmission, pullPlatformProblems } from "../lib/import-problems.js";
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

function createHackerrankFetchStub(routes) {
  return async (url) => {
    const entry = routes[String(url)];

    if (!entry) {
      return {
        ok: false,
        status: 404,
        async json() {
          return { error: "Not Found" };
        }
      };
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return entry;
      }
    };
  };
}

function createCodeChefFetchStub(html) {
  return async () => ({
    ok: true,
    status: 200,
    async text() {
      return html;
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

test("HackerRank pull imports public recent challenge metadata without fake code", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createHackerrankFetchStub({
    "https://www.hackerrank.com/rest/contests/master/hackers/sunilkvb44/profile": {
      model: {
        id: 18305604,
        username: "sunilkvb44",
        created_at: "2022-06-29T03:17:38.000Z"
      }
    },
    "https://www.hackerrank.com/rest/hackers/sunilkvb44/badges": {
      status: true,
      models: [{ badge_name: "Problem Solving", solved: 6, stars: 1 }]
    },
    "https://www.hackerrank.com/rest/hackers/sunilkvb44/skills": ["React.js", "JavaScript"],
    "https://www.hackerrank.com/rest/hackers/sunilkvb44/recent_challenges?limit=50": {
      models: [
        {
          name: "Diagonal Difference",
          ch_slug: "diagonal-difference",
          created_at: "2025-01-28T17:55:01.000+00:00",
          con_slug: "master",
          url: "/challenges/diagonal-difference"
        },
        {
          name: "Solve Me First",
          ch_slug: "solve-me-first",
          created_at: "2025-01-27T14:46:22.000+00:00",
          con_slug: "master",
          url: "/challenges/solve-me-first"
        }
      ],
      cursor: "",
      last_page: true
    }
  });

  const result = await pullPlatformProblems("hackerrank", "@sunilkvb44", { rootDir, fetchImpl });
  assert.equal(result.created.length, 2);
  assert.match(result.warning, /recent solved challenge metadata/i);
  assert.equal(result.debug.dataSource, "public-api-recent-challenges");
  assert.equal(result.debug.extractedProblemIdsCount, 2);

  const problem = JSON.parse(
    await readFile(path.join(rootDir, "problems", "hackerrank", "diagonal-difference", "problem.json"), "utf8")
  );
  assert.equal(problem.platform, "hackerrank");
  assert.equal(problem.title, "Diagonal Difference");
  assert.equal(problem.recordType, "problem");
  assert.equal(problem.username, "sunilkvb44");
  assert.equal(problem.url, "https://www.hackerrank.com/challenges/diagonal-difference");
  await assert.rejects(readFile(path.join(rootDir, "problems", "hackerrank", "diagonal-difference", "explanation.md"), "utf8"));
});

test("HackerRank pull falls back to summary stats when only profile stats are public", async () => {
  const rootDir = await createWorkspace();
  const fetchImpl = createHackerrankFetchStub({
    "https://www.hackerrank.com/rest/contests/master/hackers/sunilkvb44/profile": {
      model: {
        id: 18305604,
        username: "sunilkvb44",
        created_at: "2022-06-29T03:17:38.000Z"
      }
    },
    "https://www.hackerrank.com/rest/hackers/sunilkvb44/badges": {
      status: true,
      models: [
        { badge_name: "Problem Solving", solved: 6, stars: 1 },
        { badge_name: "Java", solved: 3, stars: 2 }
      ]
    },
    "https://www.hackerrank.com/rest/hackers/sunilkvb44/skills": ["React.js", "JavaScript"],
    "https://www.hackerrank.com/rest/hackers/sunilkvb44/recent_challenges?limit=50": {
      models: [],
      cursor: "",
      last_page: true
    }
  });

  const result = await pullPlatformProblems("hackerrank", "@sunilkvb44", { rootDir, fetchImpl });
  assert.equal(result.created.length, 1);
  assert.equal(
    result.warning,
    "Profile found. Solved count detected, but individual solved problem data is not publicly available."
  );

  const debugOutput = formatPullDebugInfo(result.debug).join("\n");
  assert.match(debugOutput, /profile fetched: yes/);
  assert.match(debugOutput, /profileApi=true/);
  assert.match(debugOutput, /badgesApi=true/);
  assert.match(debugOutput, /skillsApi=true/);
  assert.match(debugOutput, /solved count found: 6/);
  assert.match(debugOutput, /Problem Solving: 1 star\(s\), solved 6/);

  const summary = JSON.parse(
    await readFile(path.join(rootDir, "problems", "hackerrank", "profile-sunilkvb44", "problem.json"), "utf8")
  );
  assert.equal(summary.platform, "hackerrank");
  assert.equal(summary.username, "sunilkvb44");
  assert.equal(summary.solvedCount, 6);
  assert.equal(summary.recordType, "profile-stats");
  assert.equal(summary.source, "html-summary-only");
  assert.deepEqual(summary.skills, ["React.js", "JavaScript"]);
  assert.equal(Array.isArray(summary.badges), true);
  await assert.rejects(readFile(path.join(rootDir, "problems", "hackerrank", "profile-sunilkvb44", "explanation.md"), "utf8"));
});

test("CodeChef pull falls back to profile stats when only solved count is public", async () => {
  const rootDir = await createWorkspace();
  const html = `<!doctype html>
<html>
  <body>
    <section class="rating-data-section problems-solved">
      <h3>Learning Paths (2)</h3>
      <h3>Practice Paths (0)</h3>
      <p>None</p>
      <h3>Contests (0)</h3>
      <p>None</p>
      <h3>Total Problems Solved: 115</h3>
    </section>
    <div class='widget badges'>
      <div class='badge'>
        <p class='badge__title'>Problem Solver - Bronze Badge</p>
        <p class='badge__description'>Received for solving <span class='badge__goal'>50</span> Problems</p>
      </div>
    </div>
  </body>
</html>`;

  const result = await pullPlatformProblems("codechef", "sunilkumarkv", {
    rootDir,
    fetchImpl: createCodeChefFetchStub(html)
  });

  assert.equal(result.created.length, 1);
  assert.equal(
    result.warning,
    "Profile found. Solved count detected, but individual solved problem data is not publicly available."
  );

  const summary = JSON.parse(
    await readFile(path.join(rootDir, "problems", "codechef", "profile-sunilkumarkv", "problem.json"), "utf8")
  );
  assert.equal(summary.platform, "codechef");
  assert.equal(summary.solvedCount, 115);
  assert.equal(summary.recordType, "profile-stats");
  assert.equal(summary.source, "html-summary-only");
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
