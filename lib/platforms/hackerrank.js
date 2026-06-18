import { slugToTitle, slugify } from "../journal.js";

export function normalizeProblem(rawProblem) {
  return {
    platform: "HackerRank",
    slug: rawProblem.slug,
    title: rawProblem.title,
    difficulty: rawProblem.difficulty ?? "",
    url: rawProblem.url ?? "",
    tags: rawProblem.tags ?? [],
    solvedAt: rawProblem.solvedAt ?? null,
    source: rawProblem.source ?? "template",
    submissions: rawProblem.submissions ?? []
  };
}

export async function fetchSolvedProblems() {
  return {
    problems: [],
    warning: "Public accepted submissions are not available for this platform. Use cj import-submission."
  };
}

export async function fetchProblemDetails(slugOrUrl) {
  const value = String(slugOrUrl).trim();
  const match = value.match(/hackerrank\.com\/challenges\/([^/?#]+)/i);
  const slug = match ? match[1] : slugify(value);

  return normalizeProblem({
    slug,
    title: slugToTitle(slug),
    url: /^https?:\/\//i.test(value) ? value : `https://www.hackerrank.com/challenges/${slug}/problem`,
    source: "manual-template"
  });
}
