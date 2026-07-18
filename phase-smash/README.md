# Phase Smash

A hyper-casual 3D helix smasher for Android, built in **Godot 4.3** (Mobile
renderer, GDScript). One-touch: hold to smash down the tower, release to bounce.
The original twist — a phase-matching mechanic where the ball can only smash the
segments matching its current color — arrives in P1.

See [`../PHASE_SMASH_HANDOFF.md`](../PHASE_SMASH_HANDOFF.md) for the full design
and the milestone plan (P0–P7). Executor decisions are logged in
[`DECISIONS.md`](DECISIONS.md).

## Status — P7 (Release pack)

On top of P6, all the non-device release artifacts are prepared:

- **Build**: `docs/export_presets.cfg.example` (Android AAB, adaptive icon,
  minSdk 26) + `docs/RELEASE.md` (keystore `keytool`, CLI export, versionCode
  bump).
- **Store**: `docs/store/` — listing copy, privacy-policy HTML template, Data
  Safety + content-rating answer sheets, screenshots/video shot list.
- **Graphics**: `assets/store/icon_512.svg`, `assets/store/feature_graphic.svg`.

Device-only steps remain (by design, §9/§P7): build + install the signed AAB,
capture screenshots/video, on-device 60fps + airplane-mode + memory-soak
verification, and the AdMob plugin wiring with real IDs.

## Status — P6 (Hardening)

On top of P5:

- **Pause**: pause button + auto-pause on focus loss (`get_tree().paused`, HUD
  stays live), resume/restart/home + sound toggles; state saved on pause/close.
- **Back gesture** routed via the router: game pauses/resumes, menus go back,
  home double-taps to exit.
- **Safe area**: HUD top row insets below a display cutout/status bar.
- **Soak proxy** (`tools/soak.gd`): 50-level headless bot run asserting no
  orphan-node growth.
- **Adaptive icon** foreground/background + `keep_screen_on` + `config/version`.

On-device 60fps profiling, the real 30-min memory soak, and notched-panel
verification remain hardware tasks.

## Status — P5 (Ads & consent)

On top of P4:

- **Frequency-cap policy** (`AdPolicy`, pure + unit-tested): not-before-L4, ≥90s
  interval, ≥1-level gap, no interstitial within 30s of a rewarded, skip if a
  rewarded was watched that level, first-session protection, shared 6/day
  rewarded cap.
- **AdManager**: UMP consent (first launch + Settings → Privacy options),
  preload/backoff scaffold, policy gating, all touchpoints to the poing-studios
  AdMob plugin isolated behind `_has_plugin()` — silent stubs when absent, so the
  build runs and plays fully offline here.
- **Placements**: post-level interstitial (NEXT tap), revive rewarded, 2× crate
  rewarded, booster-refill rewarded. Google **test** IDs via `data/ad_config.tres`
  (real IDs injected at release); banner off behind a flag.

Cap logic proven in isolation; on-device AdMob display + airplane-mode
verification are the remaining §9 acceptance items (need Android hardware + the
plugin).

## Status — P4 (Meta-game & persistence)

On top of P3:

- **Persistence**: atomic JSON save at `user://save.json`, versioned with a
  migration stub, forward-compatible key merge, and corrupt-file recovery
  (backup + fresh + toast signal). Saves on clear, purchase/equip, settings, and
  app pause.
- **Boosters** (Shield / Slow-Mo / Head Start): equip on the pre-level screen,
  consumed on use, capped at 9, with a free shield every 5 clears.
- **Crates**: progress per clear, weighted rewards (60% shard / 30% booster /
  10% jackpot), 5 shards mint a skin, boss clears grant an instant crate.
- **12 skins**: gallery + equip; phase color always tints the skin for
  readability.
- **Screens**: Home, Pre-level, Skins gallery, Settings, Crate open, plus the
  in-game HUD/overlays.
- **Tests**: `tests/test_save.gd`, `tests/test_crates.gd` (+ generator tests) in
  the headless runner.

Meta-game logic (crate weighting 60/30/10, shard→skin, save round-trip +
recovery) verified via standalone sims; a Godot editor run is still needed to
confirm the scene/particle wiring and feel.

## Status — P3 (Art, juice, audio)

On top of P2:

- **5 themes** (Dusk Neon / Deep Ocean / Magma Core / Violet Void / Arctic Glow)
  cycling every 10 levels — procedural gradient sky + ambient + finish pad,
  semantic segment colors kept fixed.
- **Juice**: phase-colored ball trail (widens in Fever), fever flame, level-clear
  confetti (GPU particles); screen shake scaling with combo; hit-stop on hard
  bounce; camera FOV push; flip/fever/clear flashes.
- **Lite FX**: settings toggle + auto-trigger (glow off, half particles) when
  frame time exceeds budget.
- **Audio**: `AudioManager` lazy-loads SFX/music from `assets/` and stays silent
  until real CC0/CC-BY OGGs are added (see `assets/README.md`).

Syntax of all scripts verified with gdtoolkit 4.5; the particle/sky look needs a
first editor run to confirm and tune.

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
