import path from "node:path";
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

export async function explainProblem(platformInput, slug, options = {}) {
  const rootDir = resolveRootDir(options);
  const platformKey = normalizePlatform(platformInput);

  if (!platformKey) {
    throw new Error(`Unsupported platform: ${platformInput}`);
  }

  const problemDir = getProblemDirectory(rootDir, platformKey, slug);
  const explanationPath = path.join(problemDir, "explanation.md");

  if (!options.force && (await exists(explanationPath))) {
    return {
      written: false,
      reason: "explanation.md already exists"
    };
  }

  const [problem, solutions, testsFile] = await Promise.all([
    readJson(path.join(problemDir, "problem.json")),
    getSolutionEntries(rootDir, problemDir),
    readJson(path.join(problemDir, "tests.json")).catch(() => ({ tests: [] }))
  ]);

  const content = buildExplanation(problem, solutions, testsFile.tests ?? []);
  await writeTextFile(explanationPath, content, { force: true });

  return {
    written: true,
    explanationPath,
    content
  };
}
