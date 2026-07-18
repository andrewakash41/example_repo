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

## P1 — Core mechanic

- **Fake rewarded ad is always "ready" in P1** so the revive flow is exercised
  end-to-end. In P5 `_revive_available()` switches to
  `AdManager.is_rewarded_ready()` and the §3.6 "hide the button if it can't
  work" rule applies for real.
- **Phase timer pauses while smash-descending** (holding + descending), which
  operationalizes "pauses while airborne between platforms during a smash
  chain" (§3.4) — simple and prevents unfair mid-dive flips.
- **Score per shatter = round(combo multiplier)**, multiplier `1 + chain/10`
  capped ×5 (§3.8). Integer rounding keeps it casual/legible.

## P2 — Level system

- **The 1-50 curve is encoded as a function in `LevelLibrary`, not 50 `.tres`
  files.** The handoff lists `level_001.tres … level_050.tres` (§8.1), but an
  explicit interpolated curve reads as one tunable progression and avoids 50
  near-duplicate files. `LevelData.to_dict()` still dumps any level to JSON for
  the tooling schema (§5.2). Swapping to on-disk resources later is a one-file
  change in `LevelLoader`.
- **`opposite_pct` is mapped to a color run-persistence probability**
  (`LevelData.color_run_bias()`), since "opposite" is phase-relative and can't
  be baked at authoring time. Longer single-color runs force the player to wait
  for flips — the intended difficulty lever. Documented in one place to tune.
- **Winnability guarantee** = each platform has ≥2 circularly-contiguous "safe"
  (gap or matching-color) segments for *each* phase. Enforced by reroll (≤16),
  then a force-fix that carves two adjacent gaps. Verified: **0 unwinnable
  platforms across levels 1-200 and 20k stress seeds**; force-fix fires only
  ~1.4% (L50) to ~3.3% (L200) of platforms.
- **Boss towers use per-platform rotation.** Every platform is its own rotating
  node; boss levels split platforms into alternating 5-platform bands, the
  second spinning `-1.15×` (opposite direction, faster) for the "independently
  rotating bands" of §5.1. Boss clear grants +5 crate progress (an instant
  crate, §7.2).
- **Harness bot (`tools/harness_bot.gd`) + `run_tests.gd` written but not yet
  executed for curve tuning.** Godot wasn't installable here (egress policy
  blocked the download), so the §5.3 targets (e.g. "L50 in ≤5 attempts") still
  need a real run of `godot --headless -s tools/run_tests.gd` to confirm and
  tune against. The *correctness* criterion (no unwinnable platforms) is proven
  independently above.
