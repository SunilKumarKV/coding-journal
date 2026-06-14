const GITHUB_USERNAME = "SunilKumarKV";

function toProject(repo) {
  return {
    name: repo.name,
    description: repo.description,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    url: repo.html_url,
    homepage: repo.homepage,
    updatedAt: repo.updated_at
  };
}

async function fetchRepositoriesPage(page) {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(
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

export async function fetchPublicProjects() {
  const repos = [];
  let page = 1;

  while (true) {
    const currentPage = await fetchRepositoriesPage(page);

    if (!Array.isArray(currentPage) || currentPage.length === 0) {
      break;
    }

    repos.push(...currentPage);

    if (currentPage.length < 100) {
      break;
    }

    page += 1;
  }

  return repos
    .filter((repo) => !repo.fork && !repo.archived && !repo.private)
    .map(toProject)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
}
