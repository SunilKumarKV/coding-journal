import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildPublishCommandList,
  buildPublishMessage,
  getCurrentBranch,
  publishChanges
} from "../lib/publish.js";

async function createWorkspace() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "cj-publish-"));
  await Promise.all([
    mkdir(path.join(rootDir, "problems"), { recursive: true }),
    mkdir(path.join(rootDir, "data"), { recursive: true }),
    mkdir(path.join(rootDir, ".cache"), { recursive: true })
  ]);
  return rootDir;
}

function createExecStub(sequence = []) {
  const calls = [];

  async function exec(command, args) {
    calls.push([command, ...args]);
    const next = sequence.shift();

    if (!next) {
      return { stdout: "", stderr: "" };
    }

    if (next.assert) {
      next.assert([command, ...args]);
    }

    if (next.error) {
      throw next.error;
    }

    return {
      stdout: next.stdout ?? "",
      stderr: next.stderr ?? ""
    };
  }

  return { exec, calls };
}

test("buildPublishMessage prefers custom messages", () => {
  assert.equal(buildPublishMessage("feat: sync latest accepted solutions"), "feat: sync latest accepted solutions");
  assert.equal(buildPublishMessage("   "), "chore: publish coding journal updates");
});

test("getCurrentBranch detects the current branch from git", async () => {
  const rootDir = await createWorkspace();
  const { exec } = createExecStub([{ stdout: "feature/capture-sync\n" }]);
  const branch = await getCurrentBranch({ rootDir, exec });

  assert.equal(branch, "feature/capture-sync");
});

test("buildPublishCommandList builds safe non-force git commands", () => {
  assert.deepEqual(buildPublishCommandList("feature/capture-sync", "feat: sync latest accepted solutions"), [
    ["git", ["add", "."]],
    ["git", ["commit", "-m", "feat: sync latest accepted solutions"]],
    ["git", ["pull", "--rebase", "origin", "feature/capture-sync"]],
    ["git", ["push", "origin", "feature/capture-sync"]]
  ]);
});

test("publishChanges prints nothing to publish when only metadata churn exists", async () => {
  const rootDir = await createWorkspace();
  const { exec, calls } = createExecStub([
    { stdout: "feature/capture-sync\n" },
    { stdout: "git@github.com:SunilKumarKV/coding-journal.git\n" },
    { stdout: " M data/metadata.json\n" },
    { stdout: "" }
  ]);

  const result = await publishChanges({
    rootDir,
    exec,
    syncRunner: async () => ({
      summary: {
        totalProblems: 1,
        verifiedProblems: 1
      }
    })
  });

  assert.equal(result.published, false);
  assert.equal(result.message, "Nothing to publish");
  assert.deepEqual(calls, [
    ["git", "branch", "--show-current"],
    ["git", "remote", "get-url", "origin"],
    ["git", "status", "--porcelain"],
    ["git", "checkout", "--", "data/metadata.json"]
  ]);
});

test("publishChanges uses the custom commit message through commit, pull, and push flow", async () => {
  const rootDir = await createWorkspace();
  const { exec, calls } = createExecStub([
    { stdout: "feature/capture-sync\n" },
    { stdout: "git@github.com:SunilKumarKV/coding-journal.git\n" },
    { stdout: " M problems/leetcode/two-sum/problem.json\n" },
    { stdout: "" },
    { stdout: "[feature/capture-sync abc123] feat: sync latest accepted solutions\n" },
    { stdout: "Already up to date.\n" },
    { stdout: "" }
  ]);

  const result = await publishChanges({
    rootDir,
    exec,
    message: "feat: sync latest accepted solutions",
    syncRunner: async () => ({
      summary: {
        totalProblems: 2,
        verifiedProblems: 2
      }
    })
  });

  assert.equal(result.published, true);
  assert.equal(result.branch, "feature/capture-sync");
  assert.equal(result.message, "feat: sync latest accepted solutions");
  assert.deepEqual(calls, [
    ["git", "branch", "--show-current"],
    ["git", "remote", "get-url", "origin"],
    ["git", "status", "--porcelain"],
    ["git", "add", "."],
    ["git", "commit", "-m", "feat: sync latest accepted solutions"],
    ["git", "pull", "--rebase", "origin", "feature/capture-sync"],
    ["git", "push", "origin", "feature/capture-sync"]
  ]);
});
