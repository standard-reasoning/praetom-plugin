---
description: Inspect a feature, file, team, change, or get a workspace summary. praetom auto-routes based on what you pass.
---

The user invoked `/praetom:check` with arguments: `$ARGUMENTS`

This is the **single read verb** for the praetom plugin. Route arguments to the right MCP tool. All tools are namespaced `mcp__plugin_praetom_praetom__*`.

## Routing rules (in order)

- **`$ARGUMENTS` empty or "all" / "everything" / "features"** → `list_features`
- **"repos" / "workspace"** → `list_repos`
- **"alerts" / "broken" / "down" / "firing" / "what's wrong"** → `recent_alerts`
- **Starts with `@`** (team handle, e.g. `@hoverinc/team-checkout`) → `team_features(team)`
- **Looks like a list of file paths** (space- or comma-separated, contains `/` with file extensions like `.ts`, `.cs`, `.tsx`, `.py`, `.go`, `.rb`, `.java`) → this is a **change-impact query**: call `features_for_paths(paths=[...])`. Lead with how many contracts the change touches. (`check_change` is the older synonym; new agent code prefers `features_for_paths`.)
- **Looks like a single file path** → `who_owns_this(path)`
- **Slug-like** (single token, lowercase, hyphens/underscores, e.g. `checkout`, `tenant-submits-application`) → `feature_health(slug)`
- **"incidents on X" / "has X had issues" / "alerts on X" with a slug subject** → `recent_incidents(feature=X)`. Per-feature view. Fall through to `recent_alerts` for workspace-wide.
- **"impact" / "what does this touch" / "review this PR" / "what does this change touch" with no specific paths** → run `git diff HEAD` in cwd (full unified diff, not just file names); if non-empty, call `diff_impact(diff=<full output>)`. `diff_impact` parses paths itself — don't pre-extract. If `git diff HEAD` is empty, try `git diff HEAD~1 HEAD`. If still empty, tell the user.
- **Plain English description** (multiple words, no slash) → `match_intent($ARGUMENTS)` first; if there's a top match with strong score, follow up with `feature_health` on its slug. Otherwise, present the top 3 candidates and ask which they meant.

## Presentation rules

- Lead with the **event sentence** (the human-readable identifier), not the slug.
- For `feature_health` results, surface: telemetry (24h), instrumentation %, top 3-5 missing paths if low coverage, critic verdict, recent commit activity, CODEOWNERS owners.
- For `features_for_paths` / `check_change` / `diff_impact` results, lead with **how many contracts are touched** and **whether any of them have active alerts or low coverage** — the user is editing something fragile if so.
- For `recent_incidents` results, lead with the count of open vs resolved and the most recent open alert. Don't dump every row; surface the top 3-5.
- For `team_features`, group by feature and surface ownership.
- Stay terse; don't paste raw tool output back at the user. Translate to a 1-paragraph + bullet summary.

## What this command replaces

The previous `/praetom:impact` slash command is folded into `/praetom:check` via the change-impact routing rules above. Pass file paths or "what does this touch" with no args and it does the same thing.
