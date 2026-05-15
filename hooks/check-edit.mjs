#!/usr/bin/env node
/**
 * Praetom PostToolUse hook for Edit | Write | MultiEdit.
 *
 * Reads the tool-use JSON from stdin, extracts file paths, resolves
 * each one's git repo, and POSTs to praetom's check-edit endpoint.
 * If the endpoint reports a match (file is in a feature contract's
 * primary_paths), prints a one-card summary to stdout so Claude Code
 * injects it into the agent's next-turn context.
 *
 * Fails silently when:
 * - PRAETOM_API_KEY is not set (user hasn't onboarded)
 * - The edited file isn't inside a git repo
 * - The endpoint says no match
 * - The endpoint is unreachable (Railway hiccup, offline, etc.)
 *
 * Never exits non-zero. Never blocks the user.
 */

import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";

const ENDPOINT =
  process.env.PRAETOM_HOOK_ENDPOINT ||
  "https://praetom.com/api/hooks/check-edit";
const TIMEOUT_MS = Number(process.env.PRAETOM_HOOK_TIMEOUT_MS || 1500);

const apiKey = process.env.PRAETOM_API_KEY;
if (!apiKey) process.exit(0);

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch {
  process.exit(0);
}

const paths = extractPaths(payload);
if (paths.length === 0) process.exit(0);

const repoByPath = new Map();
for (const p of paths) {
  const info = repoInfo(p);
  if (info) repoByPath.set(p, info);
}
if (repoByPath.size === 0) process.exit(0);

const cards = [];
await Promise.all(
  [...repoByPath.entries()].map(async ([abs, info]) => {
    const text = await fetchCard(info.repoUrl, info.relativePath);
    if (text) cards.push(text);
  }),
);

if (cards.length > 0) {
  process.stdout.write(cards.join("\n\n"));
}
process.exit(0);

// ────────────────────────────────────────────────────────────────────

function extractPaths(p) {
  const out = new Set();
  const ti = p?.tool_input ?? {};
  if (typeof ti.file_path === "string") out.add(resolve(ti.file_path));
  if (Array.isArray(ti.edits)) {
    for (const e of ti.edits) {
      if (typeof e?.file_path === "string") out.add(resolve(e.file_path));
    }
  }
  return [...out];
}

function repoInfo(absPath) {
  const cwd = dirname(absPath);
  try {
    const root = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const remote = execFileSync(
      "git",
      ["-C", cwd, "remote", "get-url", "origin"],
      { stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .trim();
    if (!root || !remote) return null;
    const repoUrl = normalizeRepoUrl(remote);
    if (!repoUrl) return null;
    return { root, repoUrl, relativePath: relative(root, absPath) };
  } catch {
    return null;
  }
}

function normalizeRepoUrl(remote) {
  // Accept https://github.com/o/n(.git), git@github.com:o/n(.git), or bare o/n
  const m =
    /github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i.exec(remote) ||
    /^([^/]+)\/([^/.]+)$/.exec(remote);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

async function fetchCard(repoUrl, relativePath) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ repo_url: repoUrl, relative_path: relativePath }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.match && typeof j.text === "string" ? j.text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function readStdin() {
  return new Promise((res) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (buf += c));
    process.stdin.on("end", () => res(buf));
    process.stdin.on("error", () => res(buf));
  });
}
