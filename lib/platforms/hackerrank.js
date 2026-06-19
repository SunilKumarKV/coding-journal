import { slugToTitle, slugify } from "../journal.js";

const HACKERRANK_BASE_URL = "https://www.hackerrank.com";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGES = 10;

export function normalizeProblem(rawProblem) {
  return {
    platform: "hackerrank",
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
    skills: rawProblem.skills ?? [],
    recordType: rawProblem.recordType ?? "problem",
    source: rawProblem.source ?? "template",
    submissions: rawProblem.submissions ?? []
  };
}

function normalizeUsername(username) {
  return String(username).trim().replace(/^@+/, "");
}

function buildProfileSlug(username) {
  return `profile-${slugify(normalizeUsername(username))}`;
}

function toAbsoluteUrl(url) {
  if (!url) {
    return "";
  }

  return /^https?:\/\//i.test(url) ? url : `${HACKERRANK_BASE_URL}${url}`;
}

async function requestJson(pathname, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${HACKERRANK_BASE_URL}${pathname}`);

  if (!response.ok) {
    throw new Error(`HackerRank request failed with status ${response.status} for ${pathname}`);
  }

  return response.json();
}

async function requestJsonOptional(pathname, options = {}, fallbackValue = null) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${HACKERRANK_BASE_URL}${pathname}`);

  if (response.status === 404) {
    return fallbackValue;
  }

  if (!response.ok) {
    throw new Error(`HackerRank request failed with status ${response.status} for ${pathname}`);
  }

  return response.json();
}

function extractSolvedCountFromBadges(badges) {
  return badges.reduce((maxCount, badge) => {
    const solved = Number(badge?.solved);
    return Number.isFinite(solved) ? Math.max(maxCount, solved) : maxCount;
  }, 0);
}

function buildDebugInfo({ profile, badges, skills, recentChallenges, pagesFetched }) {
  return {
    profileFetched: true,
    selectorsMatched: {
      profileApi: !!profile,
      badgesApi: Array.isArray(badges),
      skillsApi: Array.isArray(skills),
      recentChallengesApi: Array.isArray(recentChallenges),
      pagesFetched
    },
    badgeValues: (badges ?? []).map((badge) => ({
      title: badge.badge_name ?? badge.badge_type ?? "badge",
      value: `${badge.stars ?? 0} star(s), solved ${badge.solved ?? 0}`
    })),
    solvedCount: extractSolvedCountFromBadges(badges ?? []),
    extractedProblemIdsCount: recentChallenges?.length ?? 0,
    dataSource: (recentChallenges?.length ?? 0) > 0 ? "public-api-recent-challenges" : "public-api-summary-only"
  };
}

async function fetchRecentChallenges(username, options = {}) {
  const models = [];
  let cursor = null;
  let pagesFetched = 0;

  while (pagesFetched < MAX_PAGES) {
    const params = new URLSearchParams({ limit: String(options.pageSize ?? DEFAULT_PAGE_SIZE) });

    if (cursor) {
      params.set("cursor", cursor);
    }

    const payload = await requestJsonOptional(
      `/rest/hackers/${encodeURIComponent(username)}/recent_challenges?${params}`,
      options,
      { models: [], cursor: "", last_page: true }
    );
    const pageModels = Array.isArray(payload.models) ? payload.models : [];
    models.push(...pageModels);
    pagesFetched += 1;

    if (payload.last_page || !payload.cursor || pageModels.length === 0) {
      break;
    }

    cursor = payload.cursor;
  }

  return {
    models,
    pagesFetched
  };
}

export async function fetchSolvedProblems(usernameInput, options = {}) {
  const username = normalizeUsername(usernameInput);
  const [profilePayload, badgesPayload, skillsPayload, recentChallengesPayload] = await Promise.all([
    requestJson(`/rest/contests/master/hackers/${encodeURIComponent(username)}/profile`, options),
    requestJsonOptional(`/rest/hackers/${encodeURIComponent(username)}/badges`, options, { models: [] }),
    requestJsonOptional(`/rest/hackers/${encodeURIComponent(username)}/skills`, options, []),
    fetchRecentChallenges(username, options)
  ]);

  const profile = profilePayload.model ?? {};
  const badges = Array.isArray(badgesPayload.models) ? badgesPayload.models : [];
  const skills = Array.isArray(skillsPayload) ? skillsPayload : [];
  const recentChallenges = recentChallengesPayload.models ?? [];
  const debug = buildDebugInfo({
    profile,
    badges,
    skills,
    recentChallenges,
    pagesFetched: recentChallengesPayload.pagesFetched
  });

  if (recentChallenges.length > 0) {
    const deduped = new Map();

    for (const challenge of recentChallenges) {
      const slug = challenge.ch_slug ? slugify(challenge.ch_slug) : null;

      if (!slug || deduped.has(slug)) {
        continue;
      }

      deduped.set(
        slug,
        normalizeProblem({
          slug,
          title: challenge.name || slugToTitle(slug),
          difficulty: "",
          url: toAbsoluteUrl(challenge.url || `/challenges/${slug}/problem`),
          tags: challenge.con_slug ? [String(challenge.con_slug)] : [],
          solvedAt: challenge.created_at ?? null,
          username,
          source: "hackerrank-public-api",
          recordType: "problem"
        })
      );
    }

    return {
      problems: Array.from(deduped.values()),
      warning:
        "HackerRank public APIs expose recent solved challenge metadata, but not accepted code or full solved history.",
      debug
    };
  }

  return {
    problems: [
      normalizeProblem({
        slug: buildProfileSlug(username),
        title: `HackerRank Profile Stats: ${username}`,
        difficulty: "",
        url: `${HACKERRANK_BASE_URL}/@${username}`,
        tags: [],
        solvedAt: null,
        username,
        solvedCount: debug.solvedCount,
        badges: badges.map((badge) => ({
          name: badge.badge_name ?? badge.badge_type ?? "badge",
          stars: badge.stars ?? 0,
          solved: badge.solved ?? 0
        })),
        skills,
        recordType: "profile-stats",
        source: "html-summary-only"
      })
    ],
    warning: "Profile found. Solved count detected, but individual solved problem data is not publicly available.",
    debug
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
