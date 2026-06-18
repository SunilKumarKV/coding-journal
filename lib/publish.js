import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runSync } from "./run-sync.js";
import { resolveRootDir } from "./journal.js";

const execFileAsync = promisify(execFile);
const METADATA_PATH = "data/metadata.json";

export function buildPublishMessage(message) {
  return message?.trim() || "chore: publish coding journal updates";
}

export function buildPublishCommandList(branch, message) {
  return [
    ["git", ["add", "."]],
    ["git", ["commit", "-m", message]],
    ["git", ["pull", "--rebase", "origin", branch]],
    ["git", ["push", "origin", branch]]
  ];
}

export function hasMeaningfulChanges(statusOutput) {
  return parseStatusEntries(statusOutput).some((entry) => entry.path !== METADATA_PATH);
}

export function parseStatusEntries(statusOutput = "") {
  return String(statusOutput)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2),
      path: line.slice(3)
    }));
}

export function getConflictedFiles(statusOutput = "") {
  const conflictCodes = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
  return parseStatusEntries(statusOutput)
    .filter((entry) => conflictCodes.has(entry.code))
    .map((entry) => entry.path);
}

export function isMetadataOnlyConflict(paths = []) {
  return paths.length === 1 && paths[0] === METADATA_PATH;
}

export async function defaultExec(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env
    }
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

async function runGit(exec, rootDir, args, options = {}) {
  return exec("git", args, {
    cwd: rootDir,
    env: options.env
  });
}

export async function getCurrentBranch(options = {}) {
  const rootDir = resolveRootDir(options);
  const exec = options.exec ?? defaultExec;
  const result = await runGit(exec, rootDir, ["branch", "--show-current"]);
  const branch = result.stdout.trim();

  if (!branch) {
    throw new Error("Could not detect the current git branch.");
  }

  return branch;
}

async function ensureOriginRemote(exec, rootDir) {
  try {
    const result = await runGit(exec, rootDir, ["remote", "get-url", "origin"]);
    const remote = result.stdout.trim();

    if (!remote) {
      throw new Error("No git remote named origin is configured.");
    }

    return remote;
  } catch (error) {
    throw new Error("No git remote named origin is configured.");
  }
}

async function getStatus(exec, rootDir) {
  const result = await runGit(exec, rootDir, ["status", "--porcelain"]);
  return result.stdout;
}

async function revertMetadataOnlyChange(exec, rootDir) {
  await runGit(exec, rootDir, ["checkout", "--", METADATA_PATH]);
}

async function resolveMetadataRebaseConflict(exec, rootDir) {
  await runGit(exec, rootDir, ["checkout", "--theirs", METADATA_PATH]);
  await runGit(exec, rootDir, ["add", METADATA_PATH]);
  await runGit(exec, rootDir, ["rebase", "--continue"], {
    env: {
      GIT_EDITOR: "true"
    }
  });
}

export async function publishChanges(options = {}) {
  const rootDir = resolveRootDir(options);
  const exec = options.exec ?? defaultExec;
  const syncRunner = options.syncRunner ?? runSync;
  const commitMessage = buildPublishMessage(options.message);

  const syncResult = await syncRunner({ rootDir });
  const branch = await getCurrentBranch({ rootDir, exec });
  const remote = await ensureOriginRemote(exec, rootDir);
  let status = await getStatus(exec, rootDir);

  if (!hasMeaningfulChanges(status)) {
    if (parseStatusEntries(status).some((entry) => entry.path === METADATA_PATH)) {
      await revertMetadataOnlyChange(exec, rootDir);
    }

    return {
      published: false,
      branch,
      remote,
      message: "Nothing to publish",
      sync: syncResult.summary,
      commands: []
    };
  }

  const commands = buildPublishCommandList(branch, commitMessage);

  await runGit(exec, rootDir, ["add", "."]);
  await runGit(exec, rootDir, ["commit", "-m", commitMessage], {
    env: {
      GIT_EDITOR: "true"
    }
  });

  try {
    await runGit(exec, rootDir, ["pull", "--rebase", "origin", branch]);
  } catch (error) {
    status = await getStatus(exec, rootDir);
    const conflictedFiles = getConflictedFiles(status);

    if (isMetadataOnlyConflict(conflictedFiles)) {
      try {
        await resolveMetadataRebaseConflict(exec, rootDir);
      } catch {
        throw new Error("Resolve conflicts, then run git rebase --continue");
      }
    } else {
      throw new Error("Resolve conflicts, then run git rebase --continue");
    }
  }

  await runGit(exec, rootDir, ["push", "origin", branch]);

  return {
    published: true,
    branch,
    remote,
    message: commitMessage,
    sync: syncResult.summary,
    commands
  };
}
