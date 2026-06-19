import { slugToTitle, slugify } from "../journal.js";

const CODECHEF_BASE_URL = "https://www.codechef.com";

export function normalizeProblem(rawProblem) {
  return {
    platform: "codechef",
    slug: rawProblem.slug,
    title: rawProblem.title,
    difficulty: rawProblem.difficulty ?? "",
    url: rawProblem.url ?? "",
    tags: rawProblem.tags ?? [],
    language: rawProblem.language ?? null,
    solvedAt: rawProblem.solvedAt ?? null,
    username: rawProblem.username ?? null,
    solvedCount: rawProblem.solvedCount ?? null,
    badges: rawProblem.badges ?? [],
    recordType: rawProblem.recordType ?? "problem",
    source: rawProblem.source ?? "template",
    submissions: rawProblem.submissions ?? []
  };
}

function normalizeUsername(username) {
  return String(username).trim().replace(/^@+/, "");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function buildProfileSlug(username) {
  return `profile-${slugify(normalizeUsername(username))}`;
}

function parseSolvedCount(html) {
  const match = html.match(/<h3>\s*Total Problems Solved:\s*(\d+)\s*<\/h3>/i);
  return match ? Number(match[1]) : null;
}

function parseBadgeValues(html) {
  const matches = html.matchAll(
    /<p class=['"]badge__title['"]>(.*?)<\/p>\s*<p class=['"]badge__description['"]>.*?<span class=['"]badge__goal['"]>(.*?)<\/span>/gis
  );
  const badges = [];

  for (const match of matches) {
    badges.push({
      title: decodeHtml(match[1].replace(/<[^>]+>/g, "")),
      value: decodeHtml(match[2].replace(/<[^>]+>/g, ""))
    });
  }

  return badges;
}

function parseContestProblems(html) {
  const sectionMatch = html.match(
    /<section class="rating-data-section problems-solved">[\s\S]*?<h3>Contests \(\d+\)\s*<\/h3>([\s\S]*?)<h3>Total Problems Solved:/i
  );

  if (!sectionMatch) {
    return [];
  }

  const contestBlocks = sectionMatch[1].matchAll(
    /<div class=['"]content['"]>\s*<h5><span[^>]*>(.*?)<\/span><\/h5>\s*<p><span>([\s\S]*?)<\/span><\/p>\s*<\/div>/gi
  );
  const problems = [];

  for (const block of contestBlocks) {
    const problemMatches = block[2].matchAll(/<span[^>]*>(.*?)<\/span>/gi);

    for (const problemMatch of problemMatches) {
      const title = decodeHtml(problemMatch[1].replace(/<[^>]+>/g, ""));

      if (title) {
        problems.push(title);
      }
    }
  }

  return problems;
}

function buildDebugInfo(html, contestProblems) {
  const badges = parseBadgeValues(html);
  const solvedCount = parseSolvedCount(html);

  return {
    profileFetched: true,
    selectorsMatched: {
      problemsSolvedSection: /<section class="rating-data-section problems-solved">/i.test(html),
      totalSolvedHeading: /Total Problems Solved:/i.test(html),
      contestCards: contestProblems.length
    },
    badgeValues: badges,
    solvedCount,
    extractedProblemIdsCount: contestProblems.length,
    dataSource: contestProblems.length > 0 ? "html-problem-list" : solvedCount !== null ? "html-summary-only" : "unavailable"
  };
}

export async function fetchSolvedProblems(usernameInput, options = {}) {
  const username = normalizeUsername(usernameInput);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${CODECHEF_BASE_URL}/users/${encodeURIComponent(username)}`);

  if (!response.ok) {
    throw new Error(`CodeChef request failed with status ${response.status}`);
  }

  const html = await response.text();
  const contestProblems = parseContestProblems(html);
  const debug = buildDebugInfo(html, contestProblems);

  if (contestProblems.length > 0) {
    const deduped = new Map();

    for (const title of contestProblems) {
      const slug = slugify(title);

      if (deduped.has(slug)) {
        continue;
      }

      deduped.set(
        slug,
        normalizeProblem({
          slug,
          title,
          difficulty: "",
          url: "",
          tags: [],
          language: null,
          solvedAt: null,
          username,
          recordType: "problem",
          source: "codechef-profile"
        })
      );
    }

    return {
      problems: Array.from(deduped.values()),
      warning:
        "CodeChef public profiles expose solved-problem titles by contest, but not accepted code, tags, or per-submission languages. Add those manually later if you want richer metadata.",
      debug
    };
  }

  if (debug.solvedCount !== null) {
    return {
      problems: [
        normalizeProblem({
          slug: buildProfileSlug(username),
          title: `CodeChef Profile Stats: ${username}`,
          difficulty: "",
          url: `${CODECHEF_BASE_URL}/users/${encodeURIComponent(username)}`,
          tags: [],
          language: null,
          solvedAt: null,
          username,
          solvedCount: debug.solvedCount,
          badges: debug.badgeValues,
          recordType: "profile-stats",
          source: "html-summary-only"
        })
      ],
      warning: "Profile found. Solved count detected, but individual solved problem data is not publicly available.",
      debug
    };
  }

  throw new Error(`CodeChef profile found, but neither solved count nor individual solved problem data is publicly available for ${username}`);
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
