# Phase Smash

A hyper-casual 3D helix smasher for Android, built in **Godot 4.3** (Mobile
renderer, GDScript). One-touch: hold to smash down the tower, release to bounce.
The original twist — a phase-matching mechanic where the ball can only smash the
segments matching its current color — arrives in P1.

See [`../PHASE_SMASH_HANDOFF.md`](../PHASE_SMASH_HANDOFF.md) for the full design
and the milestone plan (P0–P7). Executor decisions are logged in
[`DECISIONS.md`](DECISIONS.md).

## Status — P2 (Level system)

On top of P1:

- **`LevelData` schema** (§5.2) + **`LevelLibrary`**: an explicit authored
  difficulty curve for levels 1-50, procedural interpolation 51+ with a soft
  ceiling at L200, and a boss every 10th level (1.5× platforms, gold grade,
  independently-rotating bands).
- **Generator + winnability validator**: every platform guarantees ≥2
  contiguous safe segments per phase; invalid platforms are rerolled then
  force-fixed. Deterministic per level number.
- **Harness bot** (`tools/harness_bot.gd`): headless playtest sim with
  configurable reaction latency, reporting clear rate / attempts / duration /
  death causes per level.
- **Tests + runner**: `godot --headless -s tools/run_tests.gd` runs generator
  tests and prints the difficulty report.

Verified here (standalone sim, engine not runnable in this env): 0 unwinnable
platforms across levels 1-200 and 20k stress seeds. The bot-driven curve tuning
(§5.3 targets) still needs a real headless run.

## Status — P1 (Core mechanic complete)

The full core loop from §3 is in:

- **Phase system**: ball is Phase A (amber) / B (azure); material + light reflect
  it; a phase bar depletes over the phase duration and pulses ~0.5s before the
  flip, then flips with flash + haptic. Timer pauses while smash-descending so
  deep dives don't flip unfairly.
- **Four segment kinds** (amber / azure / obsidian / gap) with all §3.3–3.4
  interactions: matching+smash → shatter, opposite+smash → hard bounce (kick up,
  combo reset, input lockout), obsidian+smash → death, idle-bounce safe on any
  solid.
- **Fever**: 10 in one hold → smash everything (incl. obsidian/opposite),
  white-hot ball, +5° FOV, hold + 1.5s grace.
- **Death + revive**: slow-mo, ball shatter, tower dims, once-per-level revive
  with a 5s countdown and a **stubbed rewarded ad** (real AdMob is P5); 1.5s
  invulnerability on resume.
- **Scoring/combo**: +1 × combo (1 + chain/10, capped ×5); best + lifetime
  stored (in-memory until P4).
- Level clear → tally + crate progress; NEXT advances the level.

**Not yet** (later milestones): the authored 50-level curve + procedural/boss
(P2), real art/juice/audio (P3), boosters/crates/skins + persistent save (P4),
ads/consent (P5).

## Project layout

```
phase-smash/
  project.godot          # Godot 4.3, Mobile renderer, portrait, 60Hz physics
  icon.svg
  autoload/              # GameState, SaveManager, AudioManager, Haptics,
                         #   LevelLoader, AdManager (skeletons)
  scenes/                # main.tscn (router), home.tscn, game.tscn (minimal)
  scripts/               # main, home, game, tower_generator, shatter, hud
  DECISIONS.md
```

## Running

Open the `phase-smash/` folder as a project in Godot 4.3 and press Play.
Tap-and-hold (touch) or click-and-hold (editor) to smash.

> Note: this P0 scaffold has **not been run through the Godot editor yet** — the
> engine wasn't installable in the build environment (egress policy blocked the
> download). Scripts were written and reviewed against the Godot 4.3 API but
> need a first editor import/run to confirm.
