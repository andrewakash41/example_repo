# DECISIONS.md

Running log of executor decisions, per §13 of the handoff. One line of
rationale each. Newest at top within a phase.

## Setup / cross-cutting

- **Engine pinned to Godot 4.3 stable** (not "latest 4.x"). Reproducible
  AI-driven builds need a fixed toolchain; 4.3 is mature and within the
  poing-studios AdMob plugin's supported range. Revisit only if the plugin
  forces it (fallback rule, §2).
- **Application ID = `com.andrew.phasesmash`** (owner decision). Held as a
  single constant in `autoload/AdManager.gd` (`APPLICATION_ID`); nothing else
  hardcodes the name (§2, §13). Display name "Phase Smash" stays freely
  renamable.
- **Project lives under `phase-smash/`** inside the existing repo, on branch
  `claude/phase-smash-p0`, self-contained so it doesn't disturb the repo's
  unrelated learning files. (Owner opted to reuse this repo instead of a new
  one.)

## Known tuning risks (flagged early, resolved during P2 tuning)

- **Late-game segment budget is tight.** At L50 the schema (§5.2) sums to
  `gap 0.10 + obsidian 0.28 + opposite 0.40 = 0.78`, leaving ~0.22 (≈2 of 10
  segments) as matching. Combined with the "≥2 contiguous matching-or-gap
  reachable in each phase" guarantee, the validator will reroll heavily and
  `opposite_pct`/`obsidian_pct` may need trimming late-game. No action in P0;
  noted so it isn't a surprise when tuning.

## P0 — Scaffold

- **Greybox tower/ball/segments are built in code, not as `.tscn` scenes.**
  The handoff layout (§8.1) lists `ball.tscn`, `platform.tscn`, `tower.tscn`;
  for P0 these are procedurally constructed in `game.gd` so the greybox stays
  diff-friendly and quick to iterate. Dedicated art scenes arrive with the P3
  art pass.
- **Scene files kept minimal** (root node + attached script only); no
  hand-authored UIDs (Godot assigns them on first import). Everything else is
  constructed in GDScript — matches the "AI executor builds/diffs the whole
  project as text" rationale (§2).
- **Two segment states only in P0** (SOLID / GAP). Phase A/B colors, obsidian,
  and the winnability validator are P1/P2 work — deliberately absent here.
- **Input** is read directly from `InputEventScreenTouch` / left mouse button
  (no serialized InputMap action), so the one-touch hold works on device and in
  the editor without fragile `project.godot` event objects.
- **Idle-bounce constants** (`GRAVITY_IDLE`, `IDLE_BOUNCE_HEIGHT`) chosen to
  land near the §4 targets (≈0.45s period). Provisional greybox feel; formal
  tuning is P1.
