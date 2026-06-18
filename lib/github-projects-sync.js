import path from "node:path";
import { readJson, resolveRootDir } from "./journal.js";

const GITHUB_USERNAME = "SunilKumarKV";
const DEFAULT_CONFIG = {
  featuredProjects: []
};

function normalizeProjectName(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function stripProjectName(value) {
  return normalizeProjectName(value).replace(/[^a-z0-9]/g, "");
}

function getProjectAliases(name) {
  const normalized = normalizeProjectName(name);
  return new Set([String(name).toLowerCase(), normalized, stripProjectName(name)]);
}

async function loadPortfolioConfig(rootDir) {
  const configPath = path.join(rootDir, "portfolio.config.json");

  try {
    const config = await readJson(configPath);
    return {
      ...DEFAULT_CONFIG,
      ...config,
      featuredProjects: Array.isArray(config.featuredProjects) ? config.featuredProjects : []
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function toProject(repo, featureState) {
  return {
    name: repo.name,
    description: repo.description,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    url: repo.html_url,
    homepage: repo.homepage,
    updatedAt: repo.updated_at,
    featured: featureState.featured,
    priority: featureState.priority
  };
}

async function fetchRepositoriesPage(page) {
  return fetchRepositoriesPageWithOptions(page, {});
}

async function fetchRepositoriesPageWithOptions(page, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&page=${page}&sort=updated`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "coding-journal-sync",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub repo sync failed with status ${response.status}`);
  }

  return response.json();
}

function buildFeatureLookup(featuredProjects) {
  const lookup = new Map();

  featuredProjects.forEach((projectName, index) => {
    for (const alias of getProjectAliases(projectName)) {
      lookup.set(alias, index + 1);
    }
  });

  return lookup;
}

function getFeatureState(repoName, featureLookup, featuredCount, nonFeaturedIndex) {
  for (const alias of getProjectAliases(repoName)) {
    if (featureLookup.has(alias)) {
      return {
        featured: true,
        priority: featureLookup.get(alias)
      };
    }
  }

  return {
    featured: false,
    priority: featuredCount + nonFeaturedIndex + 1
  };
}

export async function fetchPublicProjects(options = {}) {
  const rootDir = resolveRootDir(options);
  const portfolioConfig = await loadPortfolioConfig(rootDir);
  const featureLookup = buildFeatureLookup(portfolioConfig.featuredProjects);
  const repos = [];
  let page = 1;

  while (true) {
    const currentPage = await fetchRepositoriesPageWithOptions(page, options);

    if (!Array.isArray(currentPage) || currentPage.length === 0) {
      break;
    }

    repos.push(...currentPage);

    if (currentPage.length < 100) {
      break;
    }

    page += 1;
  }

  const publicRepos = repos
    .filter((repo) => !repo.fork && !repo.archived && !repo.private)
    .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at));

  let nonFeaturedIndex = 0;
  const projects = publicRepos.map((repo) => {
    const featureState = getFeatureState(
      repo.name,
      featureLookup,
      portfolioConfig.featuredProjects.length,
      nonFeaturedIndex
    );

    if (!featureState.featured) {
      nonFeaturedIndex += 1;
    }

    return toProject(repo, featureState);
  });

  return projects.sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1;
    }

    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return new Date(right.updatedAt) - new Date(left.updatedAt);
  });
}
