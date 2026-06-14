# coding-journal-cli

`coding-journal-cli` is a Node.js CLI for managing solved coding problems and publishing structured JSON for `coding-journal`.

It creates problem folders, verifies JavaScript solutions, publishes aggregated data, and works cleanly in local development and GitHub Actions.

## Stack

- Node.js 20+
- JavaScript ESM
- Commander.js
- No database
- GitHub Actions compatible

## Repository Structure

```text
/
├── bin/
│   └── cj.js
├── lib/
│   ├── build-data.js
│   ├── constants.js
│   ├── github-projects-sync.js
│   ├── journal.js
│   ├── publish-journal.js
│   └── validate-problems.js
├── problems/
│   ├── leetcode/
│   ├── hackerrank/
│   ├── codechef/
│   ├── codeforces/
│   ├── geeksforgeeks/
│   └── custom/
├── data/
│   ├── problems.json
│   ├── projects.json
│   ├── stats.json
│   └── metadata.json
├── portfolio.config.json
├── scripts/
│   ├── build.js
│   ├── validate.js
│   └── github-projects-sync.js
├── tests/
│   └── cli.test.js
├── .github/workflows/sync.yml
├── package.json
└── README.md
```

## Supported Platforms

- `leetcode`
- `hackerrank`
- `codechef`
- `codeforces`
- `geeksforgeeks`
- `custom`

## Local Setup

Install dependencies:

```bash
npm install
```

Run the CLI locally:

```bash
npm run cli -- --help
```

Or use the binary directly:

```bash
node ./bin/cj.js --help
```

## CLI Commands

### `cj add <platform> <slug>`

Creates a new problem folder and starter files:

```text
problems/<platform>/<slug>/
├── problem.json
├── solution.js
├── tests.json
└── explanation.md
```

Example:

```bash
node ./bin/cj.js add leetcode two-sum
```

What it writes:

- `problem.json` with known fields derived from the platform and slug
- `solution.js` starter exporting a default function
- `tests.json` with an empty `tests` array
- `explanation.md` with a documentation template

The command does not invent fake tests or fake problem metadata beyond what can be derived from the slug and chosen platform.

### `cj verify`

Runs all tests for complete problem folders and updates source verification state.

Behavior:

- scans complete problems with all required files
- imports `solution.js`
- runs tests from `tests.json`
- writes `.cache/validation-results.json`
- updates each problem's `problem.json` with `verified: true` or `verified: false`

Run:

```bash
node ./bin/cj.js verify
```

### `cj publish`

Publishes journal data files:

- `data/problems.json`
- `data/stats.json`
- `data/metadata.json`

Run:

```bash
node ./bin/cj.js publish
```

### `cj stats`

Displays:

- total problems
- verified problems
- platform counts
- language counts

Run:

```bash
node ./bin/cj.js stats
```

## Problem File Format

Typical `problem.json`:

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
  "spaceComplexity": "O(n)",
  "verified": true
}
```

Typical `tests.json`:

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

`solution.js` must export a default function.

## Publishing Flow

For a full repository sync:

```bash
npm run sync
```

That runs:

1. `npm run validate`
2. `npm run build`

`npm run build` also refreshes `data/projects.json` from public GitHub repositories.

## Featured Projects

Featured project order is controlled in [portfolio.config.json](/Users/sunilkumarkv/Desktop/Projects/coding-journal/portfolio.config.json:1).

Example:

```json
{
  "featuredProjects": [
    "sunilcraft",
    "rainbowcode",
    "chessplay",
    "coding-journal",
    "attendance-tracker"
  ]
}
```

How it works:

- listed repositories are marked with `"featured": true`
- featured projects get lower `"priority"` numbers based on list order
- featured projects appear first in `data/projects.json`
- non-featured public repos still appear after featured ones
- forks, archived repos, and private repos are excluded

To feature a project:

- add its repo name or normalized alias to `featuredProjects`

To unfeature a project:

- remove it from `featuredProjects`

Name matching is normalization-aware, so values like `attendance-tracker`, `AttendanceTracker`, and `chessplay` can still match existing GitHub repo names like `AttendanceTracker` or `chessPlay`.

## Tests

Run the automated test suite:

```bash
npm test
```

The test suite covers:

- `cj add`
- `cj verify`
- `cj publish`
- `cj stats`

## GitHub Actions

The workflow:

- installs dependencies
- runs `npm test`
- runs `npm run validate`
- runs `npm run build`
- commits generated `data/` changes on `main`

## Notes

- No mock problem data is generated into published JSON.
- No dummy tests are added automatically.
- Verification only succeeds for complete problems with real passing tests.
