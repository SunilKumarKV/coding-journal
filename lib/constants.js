import path from "node:path";

export const REQUIRED_BASE_FILES = ["problem.json", "tests.json", "explanation.md"];
export const LEGACY_SOLUTION_FILENAME = "solution.js";
export const SOLUTIONS_DIRECTORY = "solutions";
export const JAVASCRIPT_SOLUTION_FILENAME = "javascript.js";

export const SOLUTION_LANGUAGE_MAP = {
  js: "JavaScript",
  javascript: "JavaScript",
  java: "Java",
  c: "C"
};

export const PLATFORM_CONFIG = {
  leetcode: {
    label: "LeetCode",
    directory: "leetcode",
    buildUrl: (slug) => `https://leetcode.com/problems/${slug}/`
  },
  hackerrank: {
    label: "HackerRank",
    directory: "hackerrank",
    buildUrl: (slug) => `https://www.hackerrank.com/challenges/${slug}/problem`
  },
  codechef: {
    label: "CodeChef",
    directory: "codechef",
    buildUrl: (slug) => `https://www.codechef.com/problems/${slug}`
  },
  codeforces: {
    label: "Codeforces",
    directory: "codeforces",
    buildUrl: () => ""
  },
  geeksforgeeks: {
    label: "GeeksForGeeks",
    directory: "geeksforgeeks",
    buildUrl: (slug) => `https://www.geeksforgeeks.org/problems/${slug}`
  },
  custom: {
    label: "Custom",
    directory: "custom",
    buildUrl: () => ""
  }
};

export function getRootDir(customRootDir) {
  return customRootDir || process.env.CJ_ROOT_DIR || process.cwd();
}

export function getPaths(rootDir) {
  return {
    rootDir,
    problemsDir: path.join(rootDir, "problems"),
    dataDir: path.join(rootDir, "data"),
    cacheDir: path.join(rootDir, ".cache"),
    validationResultsPath: path.join(rootDir, ".cache", "validation-results.json")
  };
}
