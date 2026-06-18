import { slugToTitle } from "../journal.js";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

function buildQueryPayload(query, variables) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  };
}

async function graphqlRequest(query, variables, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(LEETCODE_GRAPHQL_URL, buildQueryPayload(query, variables));

  if (!response.ok) {
    throw new Error(`LeetCode request failed with status ${response.status}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message || "LeetCode GraphQL error");
  }

  return json.data;
}

export function parseLeetCodeSlug(slugOrUrl) {
  if (/^https?:\/\//i.test(slugOrUrl)) {
    const match = slugOrUrl.match(/leetcode\.com\/problems\/([^/?#]+)/i);
    return match ? match[1] : null;
  }

  return String(slugOrUrl).trim();
}

export function normalizeProblem(rawProblem) {
  return {
    platform: "LeetCode",
    slug: rawProblem.slug,
    title: rawProblem.title,
    difficulty: rawProblem.difficulty ?? "",
    url: rawProblem.url ?? `https://leetcode.com/problems/${rawProblem.slug}/`,
    tags: rawProblem.tags ?? [],
    solvedAt: rawProblem.solvedAt ?? null,
    source: rawProblem.source ?? "leetcode-public-graphql"
  };
}

export async function fetchSolvedProblems(username, options = {}) {
  const data = await graphqlRequest(
    `
      query userProfile($username: String!) {
        matchedUser(username: $username) {
          username
          submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
        recentAcSubmissionList(username: $username) {
          title
          titleSlug
          timestamp
        }
      }
    `,
    { username },
    options
  );

  const totalSolved =
    data.matchedUser?.submitStatsGlobal?.acSubmissionNum?.find((entry) => entry.difficulty === "All")?.count ?? 0;
  const recentAccepted = data.recentAcSubmissionList ?? [];
  const seen = new Set();
  const normalizedProblems = [];

  for (const submission of recentAccepted) {
    if (!submission?.titleSlug || seen.has(submission.titleSlug)) {
      continue;
    }

    seen.add(submission.titleSlug);
    normalizedProblems.push(
      normalizeProblem({
        slug: submission.titleSlug,
        title: submission.title,
        url: `https://leetcode.com/problems/${submission.titleSlug}/`,
        solvedAt: submission.timestamp ? new Date(Number(submission.timestamp) * 1000).toISOString() : null,
        source: "leetcode-recent-ac-submissions"
      })
    );
  }

  return {
    problems: normalizedProblems,
    warning:
      totalSolved > normalizedProblems.length
        ? "LeetCode public data only exposes recent accepted submissions. For full sync, use cj import-problem for missing problems."
        : null
  };
}

export async function fetchProblemDetails(slugOrUrl, options = {}) {
  const slug = parseLeetCodeSlug(slugOrUrl);

  if (!slug) {
    return normalizeProblem({
      slug: String(slugOrUrl).trim(),
      title: slugToTitle(String(slugOrUrl).trim()),
      source: "template"
    });
  }

  const data = await graphqlRequest(
    `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          title
          titleSlug
          difficulty
          topicTags {
            name
          }
        }
      }
    `,
    { titleSlug: slug },
    options
  );

  const question = data.question;

  if (!question) {
    return normalizeProblem({
      slug,
      title: slugToTitle(slug),
      source: "template"
    });
  }

  return normalizeProblem({
    slug: question.titleSlug,
    title: question.title,
    difficulty: question.difficulty,
    url: `https://leetcode.com/problems/${question.titleSlug}/`,
    tags: (question.topicTags ?? []).map((tag) => tag.name),
    source: "leetcode-question-data"
  });
}
