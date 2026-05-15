---
description: Make praetom watch this repo, fully up to date. State-aware — runs first-time onboarding or re-discovery + drift proposal depending on whether the repo is already known.
---

The user invoked `/praetom:instrument` with arguments: `$ARGUMENTS`

This is the **single write verb** for the praetom plugin. It does whatever it takes to get the user into the most-correct state for this repo. The user never has to pick between "setup" and "refresh" and "fix" — figure it out from the repo's current state.

## Step 1 — resolve the target repo

- If `$ARGUMENTS` is a repo identifier (`owner/name`, GitHub URL, or a local path): use it.
- If `$ARGUMENTS` is empty: run `git remote get-url origin` in the current working directory to derive `owner/name`. If there's no remote, ask the user for the repo.

## Step 2 — check current state

Call `mcp__plugin_praetom_praetom__list_repos` and find this repo. Three cases:

### Case A — repo NOT in the list (first time)

This is first-time onboarding.

1. **Pick the discovery path:**
   - GitHub-accessible (public, or the praetom GitHub App is installed on the org): call `mcp__plugin_praetom_praetom__start_discovery(repo)`.
   - Local-only (private repo, no installed App): call `mcp__plugin_praetom_praetom__start_local_discovery(repo_label, files)` with a curated file list. Heuristics for file selection:
     - **Prioritize:** route handlers, controllers, service classes, webhook receivers, scheduled jobs, queue consumers, top-level config (`package.json`, `Cargo.toml`, `go.mod`, etc.), top-level `README`.
     - **Skip:** tests, fixtures, lockfiles, generated code, vendored deps, `node_modules/`, `dist/`, `build/`.
     - **Cap:** 200 files, 200KB per file.
2. **Poll** `get_discovery_status` every 10-20 seconds until terminal.
3. **Present candidates.** Lead with critic verdicts (highlight `sharpen` and `drop` in particular). Show event sentences, not slugs.
4. **Accept.** Ask which to keep. Default to "all non-dropped" if the user says "all" / "looks good". Call `accept_discovery_candidates(run_id, slugs?)`.
5. **Tell the user about the install step.** The runtime SDK is a one-time PR they open against their repo:
   ```
   // In Next.js: apps/web/instrumentation.ts
   import { register } from "praetom";
   await register();

   // In root layout / _app.tsx for browser tracing
   import { register as registerBrowser } from "praetom";
   registerBrowser({ ingestId: "praetom_..." });
   ```
   Plus one env var on their deploy: `PRAETOM_INGEST_ID=praetom_...`. Direct them to `/dashboard/integrations` to issue the token.

Frame the output as: **"praetom now watches N features in this repo."**

### Case B — repo IS in the list, code unchanged (no drift)

This is the cheap case. Either:
- The user just wants confirmation everything's hooked up — surface a summary: "praetom watches N features in this repo. Last discovery <relative time>. M of N currently instrumented."
- The user actually wants to force a re-scan — in which case proceed to Case C.

If unclear, ask. Default to summary-only.

### Case C — repo IS in the list, user wants drift check (or asked to refresh)

1. **Re-run discovery.** Use `start_discovery(repo)` (or `start_local_discovery` for private). Same 3-pass pipeline.
2. **Poll** `get_discovery_status` until terminal.
3. **Diff the result against existing contracts.** Fetch existing contracts via `list_features`. Frame the response as:
   - **New** contracts (in the new run, not in the existing set)
   - **Sharpened** contracts (slug exists, critic now says sharpen — show old vs new event sentence)
   - **Dropped** suggestions (critic now says drop)
   - **Unchanged** (most of them — just summarize the count)
4. **Accept selectively.** Default to accepting new + non-dropped candidates. Ask before replacing existing contracts. Call `accept_discovery_candidates(run_id, slugs)`.
5. **No code PR is needed.** The deployed app's SDK reads the live feature map from `/api/runtime/config` on every boot (and via SSE push when available), so new contracts start emitting spans within seconds of acceptance. No PR, no redeploy.

Frame the output as: **"praetom found N changes in this repo since last scan. Y new, Z dropped, W sharpened."**

## What this command replaces

The previous slash commands `/praetom:setup`, `/praetom:refresh`, and `/praetom:fix` are all subsumed by this one. Users don't have to pick.

The instrumentation-PR flow (the old `/praetom:fix`) is folded into Case A — the install PR is a one-time 5-line diff opened on first-time onboarding, not a per-feature PR. The runtime SDK auto-wraps files praetom names via the feature map; no per-feature PRs needed.
