import { slugToTitle, slugify } from "../journal.js";

export function normalizeProblem(rawProblem) {
  return {
    platform: "CodeChef",
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
    warning: "CodeChef public import is limited. Use cj import-problem codechef <url> for individual problems."
  };
}

export async function fetchProblemDetails(slugOrUrl) {
  const value = String(slugOrUrl).trim();
  const slug = /^https?:\/\//i.test(value)
    ? value.split("/").filter(Boolean).at(-1) || "codechef-problem"
    : slugify(value);

  return normalizeProblem({
    slug,
    title: slugToTitle(slug),
    url: /^https?:\/\//i.test(value) ? value : `https://www.codechef.com/problems/${slug.toUpperCase()}`,
    source: "manual-template"
  });
}
