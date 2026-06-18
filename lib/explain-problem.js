import path from "node:path";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  exists,
  getProblemDirectory,
  getSolutionEntries,
  normalizePlatform,
  readJson,
  readText,
  resolveRootDir,
  slugToTitle,
  writeTextFile
} from "./journal.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const PLACEHOLDER_MARKERS = [
  "Add explanation after reviewing the accepted solution.",
  "Document the solution strategy for",
  "Describe the solution strategy."
];

const SUPPORTED_AI_LANGUAGES = new Set(["JavaScript", "TypeScript", "Java", "C", "C++", "Python"]);

function inferApproach(problem, solutions) {
  if (solutions.length === 0) {
    return "No solution file exists yet, so this explanation stays as a structured skeleton ready to be filled in.";
  }

  const languageList = solutions.map((solution) => solution.language).join(", ");
  const tagList = (problem.tags ?? []).join(", ");

  if (tagList) {
    return `This problem is currently solved with ${languageList}. Based on the recorded tags (${tagList}), the implementation likely follows a direct ${tagList.toLowerCase()} driven strategy. Review the solution files and adjust this summary to reflect the exact algorithmic steps.`;
  }

  return `This problem currently has solution code in ${languageList}. Use the available implementation files as the source of truth and refine this section with the exact algorithm once you review the code.`;
}

function inferLearningPoints(problem) {
  const tags = problem.tags ?? [];
  const points = [];

  if (tags.length > 0) {
    points.push(`Revisit how the ${tags[0]} idea appears in this problem and compare it with similar questions.`);
  }

  if (problem.platform) {
    points.push(`Practice recognizing how ${problem.platform} style prompts hint at the intended data structure or algorithm.`);
  }

  points.push("Translate the solution into another language to confirm you understand the logic instead of just the syntax.");
  points.push("Add one more custom test after solving so the edge cases become part of the journal, not just the platform submission.");

  return points.slice(0, 4);
}

function buildExampleSection(tests) {
  const firstTest = tests?.[0];

  if (!firstTest) {
    return "Add a concrete example once tests are available.";
  }

  return `Input:\n\n\`\`\`json\n${JSON.stringify(firstTest.input, null, 2)}\n\`\`\`\n\nExpected Output:\n\n\`\`\`json\n${JSON.stringify(firstTest.expected, null, 2)}\n\`\`\``;
}

function buildExplanation(problem, solutions, tests) {
  const learningPoints = inferLearningPoints(problem);

  return `# ${problem.title || slugToTitle(problem.slug)}\n\n## Approach\n\n${inferApproach(problem, solutions)}\n\n## Time Complexity\n\n\`\`\`text\nO(?)\n\`\`\`\n\n## Space Complexity\n\n\`\`\`text\nO(?)\n\`\`\`\n\n## Step-By-Step Example\n\n${buildExampleSection(tests)}\n\n## Key Learning\n\n${learningPoints.map((point) => `- ${point}`).join("\n")}\n`;
}

function stripMarkdownFences(content) {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/i);
  return match ? match[1].trim() : trimmed;
}

function validateAiExplanation(content) {
  const requiredSections = [
    /^# /m,
    /^## Problem Summary$/m,
    /^## Approach$/m,
    /^## Time Complexity$/m,
    /^## Space Complexity$/m,
    /^## Step-By-Step Example$/m,
    /^## Key Learning$/m,
    /^## Languages Solved$/m
  ];

  for (const pattern of requiredSections) {
    if (!pattern.test(content)) {
      throw new Error("Gemini response is missing one or more required explanation sections.");
    }
  }
}

export function isPlaceholderExplanation(content) {
  const trimmed = String(content ?? "").trim();
  if (!trimmed) {
    return true;
  }

  return PLACEHOLDER_MARKERS.some((marker) => trimmed.includes(marker));
}

function loadEnv(rootDir) {
  dotenv.config({ path: path.join(rootDir, ".env"), quiet: true });
}

function getGeminiModelName() {
  return process.env.GEMINI_MODEL || GEMINI_MODEL;
}

function getDefaultMarkdownGenerator(rootDir) {
  loadEnv(rootDir);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to .env before running cj explain-ai.");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: getGeminiModelName() });

  return async function generateMarkdown(prompt) {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text?.trim()) {
      throw new Error("Gemini returned an empty explanation.");
    }

    return text;
  };
}

async function loadProblemContext(platformInput, slug, options = {}) {
  const rootDir = resolveRootDir(options);
  const platformKey = normalizePlatform(platformInput);

  if (!platformKey) {
    throw new Error(`Unsupported platform: ${platformInput}`);
  }

  const problemDir = getProblemDirectory(rootDir, platformKey, slug);
  const explanationPath = path.join(problemDir, "explanation.md");
  const [problem, allSolutions, testsFile, existingExplanation] = await Promise.all([
    readJson(path.join(problemDir, "problem.json")),
    getSolutionEntries(rootDir, problemDir),
    readJson(path.join(problemDir, "tests.json")).catch(() => ({ tests: [] })),
    readText(explanationPath).catch(() => "")
  ]);

  const solutions = allSolutions.filter((solution) => SUPPORTED_AI_LANGUAGES.has(solution.language));

  return {
    rootDir,
    platformKey,
    problemDir,
    explanationPath,
    problem,
    solutions,
    tests: testsFile.tests ?? [],
    existingExplanation
  };
}

function buildAiPrompt(problem, solutions, tests) {
  const solutionSections = solutions.length === 0
    ? "No solution files were found."
    : solutions
        .map(
          (solution) =>
            `Language: ${solution.language}\nFilename: ${solution.filename}\nPath: ${solution.path}\nCode:\n\`\`\`${solution.filename.split(".").pop()}\n${solution.code}\n\`\`\``
        )
        .join("\n\n");

  return `You are writing explanation.md for a coding-journal repository.

Use only the provided repository data as the source of truth.
Do not generate or include solution code.
Do not invent accepted submissions or tests.
If tests are available, use the first test case in the Step-By-Step Example section.
If tests are not available, explain a small conceptual walkthrough without claiming it came from tests.json.
If multiple language solutions exist, analyze all of them and summarize the shared algorithm.
Keep the explanation concise, accurate, and practical.

Return markdown only in exactly this structure:

# Problem Title

## Problem Summary

## Approach

## Time Complexity
\`\`\`text
O(...)
\`\`\`

## Space Complexity
\`\`\`text
O(...)
\`\`\`

## Step-By-Step Example

## Key Learning

## Languages Solved
* JavaScript

Repository data:

problem.json
\`\`\`json
${JSON.stringify(problem, null, 2)}
\`\`\`

tests.json
\`\`\`json
${JSON.stringify({ tests }, null, 2)}
\`\`\`

solutions
${solutionSections}
`;
}

export async function explainProblem(platformInput, slug, options = {}) {
  const context = await loadProblemContext(platformInput, slug, options);

  if (!options.force && (await exists(context.explanationPath))) {
    return {
      written: false,
      reason: "explanation.md already exists"
    };
  }

  const content = buildExplanation(context.problem, context.solutions, context.tests);
  await writeTextFile(context.explanationPath, content, { force: true });

  return {
    written: true,
    explanationPath: context.explanationPath,
    content
  };
}

export async function explainProblemWithAI(platformInput, slug, options = {}) {
  const context = await loadProblemContext(platformInput, slug, options);

  if (!options.force && context.existingExplanation) {
    return {
      written: false,
      reason: "explanation.md already exists"
    };
  }

  const generateMarkdown = options.generateMarkdown ?? getDefaultMarkdownGenerator(context.rootDir);
  const prompt = buildAiPrompt(context.problem, context.solutions, context.tests);
  const generated = await generateMarkdown(prompt);
  const content = stripMarkdownFences(generated);

  validateAiExplanation(content);
  await writeTextFile(context.explanationPath, content.endsWith("\n") ? content : `${content}\n`, { force: true });

  return {
    written: true,
    explanationPath: context.explanationPath,
    content
  };
}

export async function shouldAutoExplainProblem(platformInput, slug, options = {}) {
  const context = await loadProblemContext(platformInput, slug, options);
  loadEnv(context.rootDir);

  return Boolean(process.env.GEMINI_API_KEY) && isPlaceholderExplanation(context.existingExplanation);
}
