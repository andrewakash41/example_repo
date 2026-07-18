# Phase Smash

A hyper-casual 3D helix smasher for Android, built in **Godot 4.3** (Mobile
renderer, GDScript). One-touch: hold to smash down the tower, release to bounce.
The original twist — a phase-matching mechanic where the ball can only smash the
segments matching its current color — arrives in P1.

See [`../PHASE_SMASH_HANDOFF.md`](../PHASE_SMASH_HANDOFF.md) for the full design
and the milestone plan (P0–P7). Executor decisions are logged in
[`DECISIONS.md`](DECISIONS.md).

## Status — P0 (Scaffold)

Playable greybox:

- Rotating 30-platform segmented tower (data-driven, seeded/deterministic).
- Single scripted ball: **hold to smash** through solid segments, **release**
  to idle-bounce on the nearest surface. Gaps fall through.
- Segment shatter debris (script-driven, no physics bodies).
- Camera follow (~35° down) with smoothing.
- HUD: descent progress + score + control hint; level-clear panel at the base.
- Autoload skeletons (GameState, SaveManager, AudioManager, Haptics,
  LevelLoader, AdManager) with the API surface later phases fill in.

**Not yet present** (by design — later milestones): phases/colors, obsidian,
fever, revive, real art/juice/audio, boosters/crates/skins, save persistence,
ads/consent.

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
