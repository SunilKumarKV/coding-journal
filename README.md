# coding-journal

`coding-journal` is the source-of-truth repository for solved coding problems across LeetCode, HackerRank, CodeChef, Codeforces, and custom practice work. It stores each solution in a consistent folder structure and generates JSON files that SunilCraft can consume directly.

## Requirements

- Node.js 20+
- JavaScript ESM
- No database
- No frontend

## Repository Structure

```text
/
├── problems/
│   ├── leetcode/
│   ├── hackerrank/
│   ├── codechef/
│   ├── codeforces/
│   └── custom/
├── data/
│   ├── problems.json
│   ├── projects.json
│   ├── stats.json
│   └── metadata.json
├── scripts/
│   ├── build.js
│   ├── validate.js
│   └── github-projects-sync.js
├── .github/workflows/sync.yml
├── package.json
├── README.md
└── .gitignore
```

## How To Add A Solved Problem

Create a new folder under the right platform using the problem slug.

Example:

```text
problems/leetcode/two-sum/
├── problem.json
├── solution.js
├── tests.json
└── explanation.md
```

`problem.json` format:

```json
{
  "title": "Two Sum",
  "slug": "two-sum",
  "platform": "LeetCode",
  "difficulty": "Easy",
  "url": "https://leetcode.com/problems/two-sum/",
  "status": "Solved",
  "language": "JavaScript",
  "tags": ["Array", "Hash Map"],
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(n)"
}
```

`tests.json` format:

```json
{
  "tests": [
    {
      "input": [[2, 7, 11, 15], 9],
      "expected": [0, 1]
    }
  ]
}
```

`solution.js` should export a default function. The validator calls that function with the `input` array spread as arguments.

Example:

```js
export default function solve(nums, target) {
  return [];
}
```

## How Tests Work

Run:

```bash
npm install
npm run validate
```

The validator:

- scans all platform folders
- looks for `problem.json`, `solution.js`, `tests.json`, and `explanation.md`
- runs JavaScript tests from `tests.json`
- stores validation results in `.cache/validation-results.json`

If a test fails, the problem is not marked as verified in generated output.

## How JSON Is Generated

Run:

```bash
npm run build
```

This generates:

- `data/problems.json`
- `data/projects.json`
- `data/stats.json`
- `data/metadata.json`

`data/problems.json` only includes complete problems that have all required files:

- `problem.json`
- solution file
- `tests.json`
- `explanation.md`

Each generated problem includes:

- `verified`
- `detailUrl`

`detailUrl` points to the raw GitHub URL for that problem's `explanation.md`.

## How SunilCraft Consumes JSON

SunilCraft can pull the generated files from this repo directly:

- `data/problems.json` for solved-problem listings
- `data/stats.json` for aggregated counts
- `data/projects.json` for public GitHub projects
- `data/metadata.json` for build metadata

Because the data is committed into the repository, SunilCraft can consume the files through GitHub raw URLs or standard GitHub content fetches without needing a separate backend or database.

## How Project Sync Works

`scripts/github-projects-sync.js` fetches public repositories from the GitHub user `SunilKumarKV` and writes `data/projects.json`.

Included fields:

- `name`
- `description`
- `stars`
- `forks`
- `language`
- `topics`
- `url`
- `homepage`
- `updatedAt`

Excluded repositories:

- forked repos
- archived repos
- private repos

## Full Sync

Run everything with:

```bash
npm run sync
```

That command runs validation first and then builds the generated JSON.
