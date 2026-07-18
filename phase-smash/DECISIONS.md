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

## P3 — Art, juice, audio

- **All visuals are code-generated** (emissive materials, `ProceduralSkyMaterial`
  gradient sky per theme, GPU particles with billboard quads). No texture assets
  yet — the "fake bloom via halo sprites" fallback (§6.2) stays documented if
  real glow costs frames on device; for now cheap `Environment` glow is on and
  Lite FX turns it off.
- **5 themes recolor ambience only** (sky/ambient/finish), never the semantic
  amber/azure/obsidian segment hues (§6.4). Boss levels darken the grade.
- **Lite FX** is both a setting and an auto-trigger: sustained frame time above
  20ms for 5s disables glow and drops `amount_ratio` to 0.5 on all particle
  systems (§8.4). Real per-device profiling is P6.
- **Hit-stop and death slow-mo both use `Engine.time_scale`** with real-time
  (`ignore_time_scale`) timers to restore, so a fixed wall-clock freeze holds
  regardless of the current scale.
- **Audio wired but silent**: `AudioManager` lazy-loads `res://assets/{sfx,music}`
  and no-ops when a file is missing, so every call site is complete now and comes
  alive when CC0/CC-BY OGGs are dropped in (§6.5).
- **Syntax verified with gdtoolkit 4.5** (`gdparse`) across all 20 scripts;
  semantic/API correctness of the new particle + sky calls still needs a first
  editor run (engine not runnable here).

## P4 — Meta-game & persistence

- **Save is atomic-ish** (write `save.json.tmp`, remove old, rename) with a
  version + `migrate()` stub and recursive `merge_defaults()` for forward-compat
  when the schema grows. A corrupt file is copied to `save.bak`, a fresh save is
  written, and `recovered` is emitted (§8.3). Persisted on level clear, booster/
  skin/settings change, crate open, and app pause.
- **Pure logic split out for testing**: `parse_save`/`migrate`/`merge_defaults`
  (SaveManager) and all of `Boosters`/`Crates` operate on a plain dict, so they
  run without a scene. Verified — crate weighting lands at **60/30/10**
  (±0.1% over 200k draws), 5 shards mint a skin, all-owned crates fall back
  safely, and merge preserves+fills. Mirrored as GDScript suites in
  `tests/test_save.gd` and `tests/test_crates.gd`.
- **`opposite`/skin readability**: the ball's *albedo* keeps the equipped skin's
  identity while *emission* always carries the phase color, so phase stays
  readable on all 12 skins (§7.3).
- **Head Start** clears the top 25% of the tower by marking those segments
  broken and dropping the ball in below (§7.1). **Slow-Mo** multiplies tower
  rotation by 0.7. **Shield** survives one obsidian smash, then pops.
- **The 50 authored levels remain a curve, not `.tres` files** (see P2). Screens
  (pre-level, skins gallery, settings, crate open) are built in code like the
  rest of the UI; a visual-design pass is future polish.
- **Full project (30 scripts) passes gdtoolkit 4.5 `gdparse`.** Semantic/API
  correctness and the actual feel still need a first Godot editor run — the
  engine was not installable in this environment (egress policy blocked the
  download).

## P5 — Ads & consent

- **Frequency caps are pure functions** (`AdPolicy`) over an explicit state dict,
  so every §9.2 rule is unit-testable without the plugin: not-before-L4, ≥90s
  interval, ≥1-level gap, no interstitial within 30s of a rewarded, skip if a
  rewarded was watched that level, first-session first-4-levels protection, and
  the shared 6/day rewarded cap on placements 4-5. Verified — all cases pass
  (standalone sim + `tests/test_ad_policy.gd`).
- **Plugin is fully abstracted behind `_has_plugin()`** (returns false here). All
  poing-studios AdMob touchpoints are isolated in clearly-marked `_plugin_*`
  hooks; when the plugin isn't present, ads degrade to silent stubs so gameplay
  never blocks and offline play works. On Android, `_has_plugin()` becomes the
  real singleton check and the hooks are wired to the plugin API (§9.1).
- **Google TEST ad unit IDs** ship as `AdConfig` defaults / `data/ad_config.tres`;
  real IDs are injected into that resource at release (§12) — no ID hardcoded
  elsewhere. Banner stays behind `banner_enabled=false` (§9.2).
- **Consent (UMP)**: requested on first launch from `main`, re-openable via
  Settings → Privacy options. Both "obtained" and "declined" allow ads
  (declined ⇒ non-personalized); an unset status withholds ads until the flow
  completes.
- **Placements wired**: post-level interstitial on the NEXT tap (fail-silent,
  always proceeds), revive rewarded (max 1/level, only offered when
  `is_rewarded_ready()`), 2× crate rewarded on the clear screen (max 1/level),
  booster refill rewarded on pre-level (+2, daily-capped).
- **Still needs a device run** for the actual AdMob plugin + real test-ad
  display and airplane-mode verification — the acceptance items that require
  Android hardware (§9 accept). The cap logic they'd exercise is already proven
  in isolation.

## P6 — Hardening

- **Pause is real `get_tree().paused`** with the HUD set to
  `PROCESS_MODE_ALWAYS` so the menu stays interactive while everything else
  freezes. Auto-pause fires on `APPLICATION_PAUSED` (never die to a phone call,
  §8.2) and the state is persisted on pause/close.
- **Back gesture routed through the router** (§8.5): `main` forwards
  `WM_GO_BACK_REQUEST` to the active screen's `on_back_requested()` — game
  pauses/resumes, menus go home, and home double-taps to exit.
- **Safe-area inset** maps the OS display safe-area top into viewport units and
  pushes the HUD's top row below a cutout/status bar (§8.5). Approximate; a
  device pass should confirm on a notched panel.
- **Soak proxy** (`tools/soak.gd`): runs the bot across 50 consecutive levels
  headless and asserts orphan-node count doesn't grow — a CI-able stability
  smoke test. The real §6 memory soak (50 live scene loads, flat RSS over 30
  min) and on-device 60fps profiling remain device tasks.
- **Adaptive icon** foreground/background SVGs added (`assets/textures/`), art
  kept inside the launcher safe zone; wired via the export preset in P7.
- **`keep_screen_on` + versioned** (`config/version`); boot splash off for a
  fast cold start.

## P7 — Release pack

- **Everything that doesn't require the device is prepared as an artifact**:
  Android export preset (`docs/export_presets.cfg.example`), `docs/RELEASE.md`
  (keystore `keytool` command, CLI AAB export, versionCode bump rule), store
  listing copy (title ≤30 / short ≤80 / full), privacy-policy HTML template,
  Data Safety + content-rating answer sheets, 512 icon + 1024×500 feature
  graphic (SVG, export to PNG), and a screenshots/video shot list.
- **`export_presets.cfg` stays gitignored** (it references the local keystore
  path); the committed file is the `.example` template to copy + open once in
  the editor so Godot fills managed fields.
- **`target_sdk` intentionally left blank** in the template — it must be set to
  Google Play's current minimum at build time, which ratchets annually (§8.5);
  hardcoding it would silently go stale.
- **Device-only acceptance remains open by design** (§ P7 accept): building and
  installing the signed AAB, capturing the 6+ screenshots and 30s video, and the
  on-device run. These need Godot 4.3 + Android tooling + a phone, none of which
  were available in this environment.

---

## Improvement plan — R0 (CI) + R1 (bug fixes)

Executing `PHASE_SMASH_IMPROVEMENT_PLAN.md`. Environment still cannot install
Godot (GitHub release download blocked by egress policy, same as P3/P4), so all
R1 changes are verified with **gdtoolkit 4.5 `gdparse`/`gdlint` + static review**
only; the new CI runs the real Godot 4.3 suite on push. Difficulty re-tuning
(R0 step 4) is deferred to the first real engine run — the curve is untouched
except for the new per-level Fever threshold.

- **R0 — CI added** (`.github/workflows/ci.yml`): downloads Godot 4.3 headless,
  runs `tools/run_tests.gd` + `tools/soak.gd`, plus a gdtoolkit parse/lint gate.
- **B1 — revive race:** added a `REVIVE_PENDING` state entered on accept (timer
  zeroed) so the countdown can't expire mid-ad; `_do_revive` guards on it.
- **B2 — windowed tower:** the DATA model (`_seg_kind`/`_broken`/`_platform_rot`/
  `_platform_speed`) stays full-length so gameplay + harness bot are byte-for-byte
  unchanged; only the VIEW is windowed (`WINDOW_ABOVE=4`, `WINDOW_BELOW=14` live
  platforms around the ball, spawned/freed by `_update_window` each physics frame).
  Rotation still advances for all platforms (cheap) to keep collision deterministic.
  Draw-call/MultiMesh follow-up left for on-device profiling (§8.4).
- **B3 — shatter pooling:** `Shatter` (per-burst node) → `ShatterPool` (owned by
  the game) with a fixed pool of chunk nodes sharing one `BoxMesh`, each keeping
  its own reused material so alpha fades stay independent. Zero steady-state alloc.
- **B4 — audio code paths:** gameplay/boss music started in `_ready`; additive
  Fever stem (`fever.ogg`) faded in/out via `AudioManager.set_fever_layer`; pitch
  spread on shatter/hard-bounce SFX. **Assets still unsourced** — code no-ops until
  the CC0/CC-BY OGGs are dropped in `assets/{music,sfx}/` (see CREDITS.md TODO).
- **B6 — booster refund matrix** (pure `Boosters.refund_on_end`, unit-tested):
  shield refunds whenever unpopped (game-over / restart / quit); slow-mo refunds
  on restart only; head-start never refunds. Consumed at level start as before.
- **B9 — per-level Fever threshold:** new `LevelData.fever_threshold` (10, →12 from
  L30); consumed by both `game.gd` and `harness_bot.gd` (removes a duplicated const).
- **B12 — boss 2× crate:** the clear's actual gain is stored and doubled, so a
  boss's +5 becomes +10 instead of a flat +1.
- **B14 — no dead ad buttons:** new `AdManager.ad_availability_changed` signal;
  the 2×-crate and +2-refill buttons hide until a rewarded ad is ready and update live.
- **Other bugs:** B5 first-launch→L1, B7 version from ProjectSettings, B8 time_scale
  reset on every screen swap, B10 one-time hints (`hints_seen` + first-opposite
  slow-mo), B11 phase ring at the ball (torus, brightens on depletion, pulses on
  warning; true angular-fill shader is a later polish item), B13 harness fever
  no-op removed, B15 "Open another" crate, B16 skins ScrollContainer + in-place
  refresh + locked preview, B17 bottom safe-area inset, B18 dead code removed.

## R2 — refactors (C1, C5 done; C2/C3 deferred; C4 → R3)

- **C1 — SimParams:** the ~15 physics constants game.gd and harness_bot.gd
  duplicated now live in `scripts/sim_params.gd`; both alias them (values in one
  place, names stay local so gameplay reads unchanged). Directly kills the drift
  class that produced B9/B13.
- **C5 — Strings:** `scripts/strings.gd` holds a flat `const S` of player-facing
  text with `t()`/`f()` helpers (i18n-ready). Home + Settings migrated as the
  adoption pattern; remaining screens can migrate incrementally against the same keys.
- **C2 (extract ball_sim) and C3 (split game.gd) DEFERRED — needs an engine.**
  Both are "behavior-identical" refactors whose sole acceptance is the harness
  difficulty report being unchanged before/after. That report can't run here
  (no Godot). Unlike new features, a silent error in these would regress the whole
  working core with nothing to catch it in this environment — so doing them blind
  works against their own goal (bot fidelity / no behavior change). Recommend doing
  them in the first engine-available session, running the difficulty report as the
  gate exactly as the plan specifies.
- **C4 (UI theme resource) folded into R3** — it is the explicit enabler for the
  R3 visual pass, so it's implemented there alongside the styling it unblocks.
