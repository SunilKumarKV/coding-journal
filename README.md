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

Set up Gemini for AI explanations:

```bash
cp .env.example .env
```

Then add your `GEMINI_API_KEY` to `.env`.

Run the CLI locally:

```bash
npm run cli -- --help
```

Or use the binary directly:

```bash
node ./bin/cj.js --help
```

## Browser Extension

The repository includes a local Chrome extension at:

```text
extensions/leetcode-capture/
```

Purpose:

- capture real accepted LeetCode submissions
- send them to the local receiver at `http://localhost:4444/capture`

Manual install steps:

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `extensions/leetcode-capture`.

Manual testing steps:

1. Start the local receiver:
   `node ./bin/cj.js serve`
2. Open an accepted LeetCode submission page where the code is visible.
3. Wait for the extension to capture it.
4. Look for:
   `Saved to coding-journal`
5. Confirm the problem folder and solution file were created or updated locally.

Extension-specific docs:

- [extensions/leetcode-capture/README.md](/Users/sunilkumarkv/Desktop/Projects/coding-journal/extensions/leetcode-capture/README.md:1)

## CLI Commands

### `cj add <platform> <slug>`

Creates a new problem folder and starter files:

```text
problems/<platform>/<slug>/
├── problem.json
├── explanation.md
├── tests.json
└── solutions/
    └── javascript.js
```

Example:

```bash
node ./bin/cj.js add leetcode two-sum
```

What it writes:

- `problem.json` with known fields derived from the platform and slug
- `solutions/javascript.js` starter exporting a default function
- `tests.json` with an empty `tests` array
- `explanation.md` with a documentation template

The command does not invent fake tests or fake problem metadata beyond what can be derived from the slug and chosen platform.

### `cj pull <platform> <username>`

Pulls accepted-submission metadata using only public platform data.

Examples:

```bash
node ./bin/cj.js pull leetcode Sunil-Kumar-K-V
node ./bin/cj.js pull codeforces tourist
```

Current behavior:

- `leetcode`: imports public recent accepted submissions and stores metadata only when code is not publicly available
- `codeforces`: imports accepted submissions through the public Codeforces API, deduplicates by problem, and stores submission metadata
- `codechef`: safe fallback with no fake solved problems or fake code
- `hackerrank`: safe fallback with no fake solved problems or fake code

Rules:

- creates missing folders only
- merges metadata into existing folders
- uses public data only
- does not require login, cookies, or private sessions
- does not invent or generate solution code

### `cj import-submission <platform> <slug> --language <language> --file <path>`

Attaches a real accepted submission file to an existing problem.

Examples:

```bash
node ./bin/cj.js import-submission leetcode add-two-numbers --language javascript --file ./accepted/add-two-numbers.js
node ./bin/cj.js import-submission leetcode add-two-numbers --language java --file ./accepted/AddTwoNumbers.java
node ./bin/cj.js import-submission leetcode add-two-numbers --language c --file ./accepted/add_two_numbers.c
```

Supported import languages:

- JavaScript
- TypeScript
- Java
- C
- C++
- Python

Rules:

- copies the provided file into `solutions/`
- updates `problem.json.submissions`
- never overwrites real code unless `--force`
- may replace the generated starter template with your real accepted code

### `cj import-problem <platform> <slug-or-url>`

Imports one problem by slug or URL and creates a full template set.

Examples:

```bash
node ./bin/cj.js import-problem leetcode add-two-numbers
node ./bin/cj.js import-problem leetcode https://leetcode.com/problems/add-two-numbers/
node ./bin/cj.js import-problem codechef https://www.codechef.com/problems/FLOW001
```

Generated structure:

```text
problems/<platform>/<slug>/
├── problem.json
├── explanation.md
├── tests.json
└── solutions/
    ├── javascript.js
    ├── java.java
    └── c.c
```

It does not overwrite existing files unless `--force`.

### `cj explain <platform> <slug>`

Generates `explanation.md` deterministically from:

- `problem.json`
- `tests.json`
- `solutions/*`

Example:

```bash
node ./bin/cj.js explain leetcode add-two-numbers
```

Rules:

- does not overwrite `explanation.md` unless `--force`
- uses the first test case when available
- generates a useful skeleton even when no solution is present

### `cj explain-ai <platform> <slug>`

Generates `explanation.md` with Gemini from:

- `problem.json`
- `tests.json`
- `solutions/*`

Example:

```bash
node ./bin/cj.js explain-ai leetcode longest-common-prefix
```

Rules:

- reads `GEMINI_API_KEY` from `.env`
- does not generate or modify solution code
- supports JavaScript, TypeScript, Java, C, C++, and Python solutions
- includes all available supported-language solutions in the analysis prompt
- does not overwrite `explanation.md` unless `--force`

### `cj verify`

Runs all tests for complete problem folders and updates source verification state.

Behavior:

- scans complete problems with all required files
- imports JavaScript solutions when a real JavaScript file exists
- runs tests from `tests.json`
- writes `.cache/validation-results.json`
- updates each problem's `problem.json` with `verified: true` or `verified: false`

Run:

```bash
node ./bin/cj.js verify
```

### `cj build`

Publishes journal data files:

- `data/problems.json`
- `data/stats.json`
- `data/metadata.json`

Run:

```bash
node ./bin/cj.js build
```

### `cj publish`

Runs `cj sync` first, then safely publishes the current git branch.

Run:

```bash
node ./bin/cj.js publish
node ./bin/cj.js publish -m "feat: sync latest accepted solutions"
```

Behavior:

- runs `cj sync` before any git write
- detects the current branch automatically
- checks `origin` before committing
- prints `Nothing to publish` when there are no meaningful changes
- stages changes with `git add .`
- commits with your custom message or a safe default
- runs `git pull --rebase origin <current-branch>`
- runs `git push origin <current-branch>`

Safety rules:

- never force-pushes
- always pushes the detected current branch, not `main` by mistake
- if rebase conflicts happen, it stops with:
  `Resolve conflicts, then run git rebase --continue`
- if the only rebase conflict is `data/metadata.json`, it automatically keeps the local generated version and continues when safe
- if `origin` is missing, it prints a clear error instead of creating a partial publish flow

Example workflow:

```bash
node ./bin/cj.js serve
node ./bin/cj.js explain-ai leetcode longest-common-prefix
node ./bin/cj.js publish -m "feat: sync latest accepted solutions"
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

### `cj sync`

Runs validation and build, then prints a concise summary.

```bash
node ./bin/cj.js sync
```

### `cj release`

Runs `cj sync`, compares the refreshed journal data with the previous snapshot, writes a release summary, and prints a PR suggestion.

Generated file:

- `docs/releases/latest.md`

Run:

```bash
node ./bin/cj.js release
```

Behavior:

- runs `cj sync` first
- detects newly added problems by comparing `data/problems.json` before and after sync
- detects newly added languages from the refreshed problem set
- summarizes verified problem count, platform counts, and language counts
- includes the latest solved problems in a recent activity section
- prints the suggested PR title:
  `feat: sync coding journal progress`
- prints a PR description you can paste into GitHub
- does not push, commit, or open a PR automatically

Typical flow:

```bash
node ./bin/cj.js sync
node ./bin/cj.js release
node ./bin/cj.js publish -m "feat: sync latest accepted solutions"
```

### `cj serve`

Starts the local capture server for browser-extension submissions.

Server:

```text
http://localhost:4444
```

Endpoint:

```text
POST /capture
```

Usage:

```bash
node ./bin/cj.js serve
```

Sample `curl` test:

```bash
curl -X POST http://localhost:4444/capture \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "leetcode",
    "slug": "add-two-numbers",
    "title": "Add Two Numbers",
    "difficulty": "Medium",
    "url": "https://leetcode.com/problems/add-two-numbers/",
    "tags": ["Linked List", "Math"],
    "language": "JavaScript",
    "code": "export default function solve() { return null; }",
    "acceptedAt": "2026-06-16T10:00:00.000Z"
  }'
```

Behavior:

- creates or updates `problem.json`
- saves the provided real code into `solutions/`
- updates `problem.json.submissions`
- creates `tests.json` only if missing
- creates `explanation.md` only if missing
- when a new captured problem still has the placeholder explanation and `GEMINI_API_KEY` is configured, it auto-generates a real `explanation.md`
- does not overwrite an existing solution file
- runs the existing sync flow after capture

## Problem File Format

Typical `problem.json`:

```json
{
  "platform": "leetcode",
  "slug": "add-two-numbers",
  "title": "Add Two Numbers",
  "difficulty": "Medium",
  "url": "https://leetcode.com/problems/add-two-numbers/",
  "tags": ["Linked List", "Math"],
  "solvedAt": "2026-06-18T00:00:00.000Z",
  "submissions": [
    {
      "language": "JavaScript",
      "submittedAt": "2026-06-18T00:00:00.000Z",
      "source": "leetcode",
      "codeAvailable": true,
      "filename": "solutions/javascript.js"
    }
  ],
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

The preferred JavaScript solution path is `solutions/javascript.js`, and it must export a default function.

Backward compatibility:

- older problems using `solution.js` are still supported
- build reads both legacy `solution.js` and all files inside `solutions/`
- validation only executes a JavaScript solution for now

## Publishing Flow

For a full repository sync:

```bash
npm run sync
```

That runs:

1. `npm run validate`
2. `npm run build`

`npm run build` also refreshes `data/projects.json` from public GitHub repositories.

## Multi-Language Solutions

Problem folders can now store multiple languages:

```text
problems/<platform>/<slug>/
├── problem.json
├── explanation.md
├── tests.json
└── solutions/
    ├── javascript.js
    ├── java.java
    └── c.c
```

Generated `data/problems.json` includes:

- full explanation markdown content
- a `solutions` array with `language`, `filename`, `code`, and `path`
- a `submissions` array copied from `problem.json`

Only JavaScript is validated today when a JavaScript solution is present. Java and C files are published but not executed yet.

## Import Workflows

LeetCode metadata pull:

```bash
node ./bin/cj.js pull leetcode Sunil-Kumar-K-V
node ./bin/cj.js sync
```

Attach accepted code:

```bash
node ./bin/cj.js import-submission leetcode add-two-numbers --language javascript --file ./accepted/add-two-numbers.js
node ./bin/cj.js import-submission leetcode add-two-numbers --language java --file ./accepted/AddTwoNumbers.java
node ./bin/cj.js import-submission leetcode add-two-numbers --language c --file ./accepted/add_two_numbers.c
```

Generate explanation:

```bash
node ./bin/cj.js explain leetcode add-two-numbers
```

Generate AI explanation:

```bash
node ./bin/cj.js explain-ai leetcode add-two-numbers
```

Single problem template import:

```bash
node ./bin/cj.js import-problem leetcode add-two-numbers
node ./bin/cj.js sync
```

Codeforces pull:

```bash
node ./bin/cj.js pull codeforces tourist
node ./bin/cj.js sync
```

Manual fallback platforms:

```bash
node ./bin/cj.js import-problem codechef <url>
node ./bin/cj.js import-problem hackerrank <url>
```

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
- `cj pull`
- `cj import-submission`
- `cj serve` capture logic
- `cj explain-ai` with mocked Gemini responses
- `cj verify`
- `cj build`
- `cj publish`
- `cj release`
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
