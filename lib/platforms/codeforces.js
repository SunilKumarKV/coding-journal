import { slugToTitle, slugify } from "../journal.js";

const CODEFORCES_API_BASE = "https://codeforces.com/api";

async function apiRequest(pathname, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${CODEFORCES_API_BASE}${pathname}`);

  if (!response.ok) {
    throw new Error(`Codeforces request failed with status ${response.status}`);
  }

  const json = await response.json();

  if (json.status !== "OK") {
    throw new Error(json.comment || "Codeforces API error");
  }

  return json.result;
}

function buildProblemUrl(problem) {
  return `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
}

export function buildCodeforcesSlug(problem) {
  return `${problem.contestId}-${String(problem.index).toLowerCase()}-${slugify(problem.name)}`;
}

export function parseCodeforcesProblemIdentifier(slugOrUrl) {
  const value = String(slugOrUrl).trim();
  const urlMatch = value.match(/codeforces\.com\/(?:problemset\/problem|contest\/\d+\/problem)\/(\d+)\/([A-Za-z0-9]+)/i);

  if (urlMatch) {
    return { contestId: Number(urlMatch[1]), index: urlMatch[2].toUpperCase() };
  }

  const slugMatch = value.match(/^(\d+)-([a-z0-9]+)(?:-|$)/i);

  if (slugMatch) {
    return { contestId: Number(slugMatch[1]), index: slugMatch[2].toUpperCase() };
  }

  return null;
}

export function normalizeProblem(rawProblem) {
  return {
    platform: "Codeforces",
    slug: rawProblem.slug,
    title: rawProblem.title,
    difficulty: rawProblem.difficulty ?? "",
    url: rawProblem.url,
    tags: rawProblem.tags ?? [],
    solvedAt: rawProblem.solvedAt ?? null,
    source: rawProblem.source ?? "codeforces-api",
    submissions: rawProblem.submissions ?? []
  };
}

export async function fetchSolvedProblems(username, options = {}) {
  const submissions = await apiRequest(`/user.status?handle=${encodeURIComponent(username)}&from=1&count=1000`, options);
  const accepted = submissions.filter((submission) => submission.verdict === "OK" && submission.problem?.contestId && submission.problem?.index);
  const deduped = new Map();

  for (const submission of accepted) {
    const key = `${submission.problem.contestId}-${submission.problem.index}`;

    if (!deduped.has(key)) {
      deduped.set(key, submission);
    }
  }

  return {
    problems: Array.from(deduped.values()).map((submission) =>
      normalizeProblem({
        slug: buildCodeforcesSlug(submission.problem),
        title: submission.problem.name,
        difficulty: submission.problem.rating ? `Rating ${submission.problem.rating}` : "",
        url: buildProblemUrl(submission.problem),
        tags: submission.problem.tags ?? [],
        solvedAt: submission.creationTimeSeconds
          ? new Date(submission.creationTimeSeconds * 1000).toISOString()
          : null,
        source: "codeforces-user-status",
        submissions: [
          {
            language: submission.programmingLanguage || null,
            submittedAt: submission.creationTimeSeconds
              ? new Date(submission.creationTimeSeconds * 1000).toISOString()
              : null,
            source: "codeforces",
            codeAvailable: false,
            filename: null
          }
        ]
      })
    ),
    warning: null
  };
}

export async function fetchProblemDetails(slugOrUrl, options = {}) {
  const identifier = parseCodeforcesProblemIdentifier(slugOrUrl);

  if (!identifier) {
    const slug = slugify(String(slugOrUrl).trim());
    return normalizeProblem({
      slug,
      title: slugToTitle(slug),
      url: /^https?:\/\//i.test(String(slugOrUrl).trim()) ? String(slugOrUrl).trim() : "",
      source: "template"
    });
  }

  const problemset = await apiRequest("/problemset.problems", options);
  const matched = (problemset.problems ?? []).find(
    (problem) => problem.contestId === identifier.contestId && String(problem.index).toUpperCase() === identifier.index
  );

  if (!matched) {
    const slug = `${identifier.contestId}-${identifier.index.toLowerCase()}`;
    return normalizeProblem({
      slug,
      title: slugToTitle(slug),
      url: `https://codeforces.com/problemset/problem/${identifier.contestId}/${identifier.index}`,
      source: "template"
    });
  }

  return normalizeProblem({
    slug: buildCodeforcesSlug(matched),
    title: matched.name,
    difficulty: matched.rating ? `Rating ${matched.rating}` : "",
    url: buildProblemUrl(matched),
    tags: matched.tags ?? [],
    source: "codeforces-problemset"
  });
}
