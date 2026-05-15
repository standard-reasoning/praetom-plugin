---
description: Dev-only — emulate the /praetom:instrument 3-pass flow locally using the agent's own LLM context (your Claude subscription, not praetom's). Use this to iterate on the terminal rendering UX without burning praetom tokens.
---

The user invoked `/praetom:test-instrument` with arguments: `$ARGUMENTS`

**Mode:** dev. You ARE the discovery pipeline this run. Do NOT call any `mcp__plugin_praetom_praetom__*` tools — those would hit the real praetom server, which is what we're avoiding. All reasoning happens in your context using your own LLM. The point is to test how the terminal renders the multi-stage flow, not to produce production-quality contracts.

## Step 1 — resolve the target path

- If `$ARGUMENTS` is a directory path (absolute or relative): use it.
- If `$ARGUMENTS` is empty: ask the user which directory.

Reject if the path doesn't exist or is empty.

## Step 2 — simulate workspace state (existing features)

The real `start_discovery` runs against a workspace that may already have features instrumented for this repo. Phase 3 needs to classify each new candidate against that prior set: is this **already instrumented**, is it a **drift** from something existing, or is it **net-new**?

For the test command, fake the workspace state by inventing 0-2 plausible "existing features" relevant to the target directory. Pick ones that overlap with at least one candidate you'll generate in phase 2 so the rendering exercises all three states.

Render the simulated state BEFORE phase 1 so the reader sees the prior context:

```markdown
## ─── workspace state ───

The workspace already has N features for this repo.

| Slug | Event | Paths |
|---|---|---|
| `existing-slug-1` | Sentence-shaped event description. | path1, path2 |
```

If you generate zero existing features (greenfield case), render: "No existing features for this repo — every candidate will be net-new." and skip the table.

## Step 3 — run the 3 passes inline, streaming output as you go

Stream each phase as a section so the user can watch progress. Use the exact heading/formatting shape below so we can compare to the real praetom rendering.

### Header style (applies to every phase)

Each phase opens with a **markdown H2 heading** so it renders bold and visually distinct from body text:

```markdown
## ─── section title ───
```

The `##` is the source of the visual weight — Claude Code styles H2 headings bold and at heading scale. The framing dashes are decoration so the heading reads as a section marker, not just a title. Do NOT use backticks anywhere in the heading (that triggers the purple inline-code styling).

Below the header, write a **short sentence** (10-20 words) describing what just happened — NOT a terse badge like `✓ codebase mapped`. The reader should learn something from this line. Then a blank line, then the table.

### Phase 1 — read the codebase + build the domain model

Header:

```markdown
## ─── reading the codebase ───
```

Below it, a short sentence describing what you found — e.g. "Mapped a Next.js Rails-style monorepo with N entry points and M handlers."

1. `Glob` the target path for `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.json`, `*.md` (cap at ~30 files; this is a small-repo test).
2. `Read` each file (skip lockfiles, generated artifacts).
3. Synthesize and render as a **single** key-value table. Rules learned from rendering breakage:
   - Header row must be non-empty — use `Field | Value`.
   - No `<br>` in cells — Claude Code's table parser drops the entire table when cells contain HTML. Render multi-surface info as multiple rows instead.
   - Keep every cell to one terminal line of prose (~80 chars max).
   - Inline code (backticks) is fine inside cells; just don't go long.

```markdown
| Field | Value |
|---|---|
| **Domain** | one short sentence on what this is |
| **Business model** | one line on revenue / billable unit |
| **Activation** | one line on first useful thing for the user |
| **Surface** | sentence-shaped event #1 (one row per surface) |
| **Surface** | sentence-shaped event #2 |
| **Surface** | sentence-shaped event #3 |
| **Files analyzed** | comma-separated list of paths actually read |
```

After the header, write a one-sentence description of what was mapped (NOT `✓ codebase mapped`). Then a blank line, then the table.

### Phase 2 — propose feature contracts

Header:

```markdown
## ─── proposing features ───
```

Produce **3-5 candidates** and render them as a **single table**. Every cell must be short enough to fit on one terminal line (~12 words max). The event sentence IS the description — don't cram a paragraph into a cell. Detail comes on-demand via the accept prompt.

```markdown
| Event | Slug | Paths |
|---|---|---|
| Sentence-shaped event description, 6-14 words | `slug-here` | path1, path2 |
```

Below the header write a sentence describing what was found (e.g. "Found 4 candidate features covering the wrap path, fetch propagation, auto-wrap boot, and beacon flush."). Then a blank line, then the table. Nothing below the table.

### Phase 3 — review identified features

Header:

```markdown
## ─── reviewing identified features ───
```

Render as a **single table**. Every cell must fit on one terminal line. The verdict column combines two judgments into one value:

- `≡ exists` — paths overlap with an existing feature AND the event sentence is materially the same. No action needed.
- `↻ drift` — paths overlap with an existing feature BUT the slug or event sentence has shifted. Suggest a rename of the existing feature to match the candidate.
- `+ keep` — no path overlap with existing → net-new, candidate reads cleanly.
- `+ sharpen` — no path overlap, but candidate's name/sentence is jargon-y; suggest a sharper version.
- `+ drop` — no path overlap, candidate is too thin / redundant / not worth instrumenting.

Match rule: a candidate is "overlapping" if ANY path in its `Paths` cell matches ANY path in an existing feature's `Paths` cell (substring match is fine; exact match is preferred).

```markdown
| Event | Verdict | Suggested |
|---|---|---|
| Original event sentence | ≡ exists | — |
| Original event sentence | ↻ drift | rename `existing-slug` → `candidate-slug` |
| Original event sentence | + keep | — |
| Original event sentence | + sharpen | New event sentence (`new-slug`) |
| Original event sentence | + drop | — |
```

Below the header write a sentence describing the review breakdown (e.g. "Reviewed the 4 candidates — 1 already exists, 1 drifted from existing, 2 are net-new."). Then a blank line, then the table. Nothing below the table.

## Step 4 — accept prompt

Print:

```
## ─── result ───

N candidates reviewed. E exist, R drift (rename), K keep, S sharpen, D drop.

Reply with 'accept all' / 'accept <slug,slug>' / 'show me <slug> in more detail' / 'redo'.
```

Do NOT call `accept_discovery_candidates`. This is a dev test — the prompt is rhetorical. The user is evaluating the rendering, not actually accepting anything.

## What this command is for (and isn't for)

This is a UX iteration loop for the terminal rendering of the praetom instrument flow. The real flow takes 3-5 min and burns ~$3 of praetom's Anthropic spend. This version takes ~30-60s of agent reasoning and burns the user's Claude Code subscription tokens — much cheaper for iterating on the look-and-feel of the stage markers, candidate cards, critic table, and final prompt.

When the real flow's rendering changes (e.g. you add a `thinking…` preview block, or change the candidate card layout), update this command to mirror the new shape so we can keep testing the UX in isolation.

NEVER call praetom MCP tools from this command. If you find yourself reaching for `start_discovery` or `accept_discovery_candidates`, you've left the test path.
