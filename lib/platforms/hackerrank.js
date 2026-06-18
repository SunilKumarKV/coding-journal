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
    source: rawProblem.source ?? "template"
  };
}

export async function fetchSolvedProblems() {
  return {
    problems: [],
    warning: "HackerRank public import is limited. Use cj import-problem hackerrank <url> for individual problems."
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
