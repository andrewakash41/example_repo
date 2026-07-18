# PHASE SMASH — Codebase Review & Improvement Plan (Handoff to Opus)

**Document type:** Implementation handoff — executes on top of the existing game code.
**Code under review:** branch `claude/phase-smash-p0`, directory `phase-smash/` (~3,200 lines GDScript, Godot 4.3, phases P0–P7 complete per `PHASE_SMASH_HANDOFF.md`).
**Goal:** take the game from "feature-complete but never executed" to a polished, ship-quality, monetizable Play Store release.
**Companion docs:** the original `PHASE_SMASH_HANDOFF.md` (spec — still authoritative for anything not amended here) and `phase-smash/DECISIONS.md` (decision log — keep appending).

---

## 0. Context — state of the codebase

The full review found a genuinely well-architected codebase: pure/testable logic modules (`AdPolicy`, `Crates`, `Boosters`, `SaveManager` helpers, `TowerGenerator`), a clean autoload facade for ads, a deterministic level system, and a headless playtest bot. The structure is sound. **Keep it — nothing below is a rewrite.**

However, three facts dominate everything else:

1. **The game has never been run.** The original build environment couldn't install Godot (`DECISIONS.md` P3/P4 notes). Every script is syntax-checked (`gdparse`) only. The unit tests and the difficulty-tuning harness have **never executed**.
2. **The game is completely silent.** `assets/sfx/` and `assets/music/` contain only `.gitkeep`. Code paths exist and no-op gracefully, but no audio was ever sourced. Gameplay music isn't even started by code (see B4).
3. **The rendering approach will likely miss the 60 fps target.** The whole tower (up to ~90 platforms × 10 segments ≈ 900 `MeshInstance3D`s) is instantiated up front, violating the spec's own pooling/lazy-build and <60 draw-call budgets (§8.4 of the handoff). See B2.

Everything in this plan is ordered so the game becomes *runnable and verified first*, then *correct*, then *fast*, then *beautiful*, then *bigger*.

Rules of engagement are unchanged from the original handoff §0 (Opus owns all technical decisions, logs them in `DECISIONS.md`, only asks Andrew for accounts/devices/credentials). Three **owner decisions** are flagged in §6 — proceed with the stated defaults unless Andrew objects.

---

## 1. Milestone R0 — Boot, verify, tune (do this before touching anything else)

The single highest-risk item is that ~3,200 lines of never-executed code meet a real engine for the first time.

1. Install Godot **4.3 stable** (pinned in `DECISIONS.md`) in the dev environment. If the environment's egress policy still blocks the download, that is a blocker to surface immediately — nothing else in this plan is safely doable without a running engine.
2. Run the headless suite: `godot --headless -s tools/run_tests.gd` from `phase-smash/`. Fix every failure. Then `tools/soak.gd`.
3. Run the game (`scenes/main.tscn`) on desktop. Play levels 1–10, a boss level, a death/revive, a crate open, every screen. Fix all runtime errors and API misuses (the particle/sky/material calls in `scripts/juice.gd` and `game.gd:171-225` were flagged in `DECISIONS.md` as "needs a first editor run").
4. Run the difficulty report and tune the L1–50 curve in `scripts/level_library.gd` until the §5.3 targets of the original handoff hold (L50 ≤5 attempts at 250 ms bot latency, monotonic-ish ramp). This was authored but never verified.
5. **Add CI now** (GitHub Actions): a workflow that downloads Godot 4.3 headless and runs `tools/run_tests.gd` + `tools/soak.gd` on every push. The repo currently has zero CI; every later milestone benefits.

**Accepts when:** clean test run, difficulty targets met, 15-minute desktop play session with no errors in the output log, CI green on the branch.

---

## 2. Milestone R1 — Bug fixes

Fix in this order. Each item names the file(s). Log non-obvious choices in `DECISIONS.md`.

### Correctness

- **B1 — Revive race (real bug).** `scripts/game.gd`: the revive countdown in `_process` keeps ticking after the player taps *WATCH AD — REVIVE* (`_on_revive_accept` neither stops the timer nor leaves `State.REVIVING`). With a real rewarded ad (or even the 0.8 s stub) the countdown can hit zero mid-ad → `_on_revive_decline` → `_show_game_over` (state `FINISHED`), after which the reward callback `_do_revive` runs anyway and sets the state back to `PLAY` on top of the game-over screen. Fix: on accept, zero `_revive_timer` / move to a distinct `REVIVE_PENDING` state; guard `_do_revive` and `_show_game_over` on expected states.
- **B2 — Tower rendering strategy (perf-critical, spec §8.4 violation).** `game.gd:_build_tower` instantiates every platform/segment up front — up to ~900 MeshInstances plus 90 rotating `Node3D`s, vs the spec's "pool 12 platforms, instantiate lazily, <60 draw calls". On the Snapdragon-680 target this likely breaks 60 fps outright. Fix: keep the *data* model exactly as is (`_seg_kind`/`_broken` arrays already separate state from view) and make the *view* windowed — only the ~12 platforms nearest the ball have live nodes; recycle platform nodes as the ball descends. If profiling still shows draw-call pressure, move segments to one `MultiMesh` per segment type. Verify with the profiler on a real device.
- **B3 — Shatter debris churn.** `scripts/shatter.gd` allocates 6 meshes + 6 unique materials per burst, and Fever chains produce ~10 bursts/second. Pool the chunk nodes (spec'd in §6.2/§8.4) and share 4 pre-built materials (one per segment color) with alpha driven via `transparency`+`albedo_color` on instance uniforms or per-chunk `modulate`-style fade using a shared shader.
- **B4 — No gameplay music, no audio at all.** `game.gd` never calls `AudioManager.play_music(&"game")`; the Fever music layer (§6.5) is unimplemented; and zero audio files exist. Fix: (a) source the CC0/CC-BY set the spec lists (Kenney/FreePD/OpenGameArt — 2 music loops + fever stem + the 8 SFX ids already enumerated in `AudioManager.SFX_IDS`), normalize, keep <4 MB OGG, attribute in `CREDITS.md`; (b) start gameplay music in `game.gd:_ready`, add the additive fever stem toggled by `_start_fever`/`_end_fever`; (c) add 3 pitch variants for shatter (spec §6.5) — cheap via `pitch_scale` randomization in `AudioManager.play_sfx`.
- **B5 — First-launch flow doesn't match spec (§10.9).** `scripts/main.gd:_ready` always routes to Home. Spec: first launch goes consent → straight into Level 1. Use `SaveManager.data["ads"]["sessions_started"] == 1` (already tracked) to route to game directly on the first session.
- **B6 — Boosters consumed even when unused.** `Boosters.consume_equipped` runs in `game.gd:_ready` and saves immediately, so a player who equips a Shield and then restarts, quits, or simply never touches obsidian loses it for nothing — this will read as theft to players and poisons the rewarded-ad economy. Fix: consume at level *start* still (simplest anti-exploit), but **refund unused boosters** on restart-from-pause and on game-over *if the effect never triggered* (shield never popped, head-start is fine to keep consumed, slow-mo refund on restart only). Document the exact matrix in `DECISIONS.md`.
- **B7 — Version string drift.** `scripts/settings_screen.gd` hardcodes "v0.5 (P5)"; `project.godot` says 0.6.0. Read `ProjectSettings.get_setting("application/config/version")` instead.
- **B8 — `Engine.time_scale` leak hardening.** Hit-stop and death slow-mo (`game.gd:_hit_stop`, `_die`) restore `time_scale` via scene-tree timers connected to methods on the game node. Any future path that frees the game scene mid-timer leaves the whole app at 0.4× or frozen. Defensive fix: `main.gd:_swap` unconditionally resets `Engine.time_scale = 1.0` (and `get_tree().paused = false`) before swapping screens.
- **B9 — Fever threshold not level-tunable.** Spec §4: threshold 12 from level 30+. `FEVER_THRESHOLD` is a const 10 in both `game.gd` and `tools/harness_bot.gd`. Add `fever_threshold` to `LevelData` + the curve in `LevelLibrary`, consume it in both places (see C2 which removes the duplication).
- **B10 — Missing tutorial affordances (§5.3).** No "Wait for the color flip!" contextual hint on the first opposite-color encounter, no one-time 0.3× time-slow for it, and the single existing hint shows every level forever. Add a `hints_seen` dict to the save schema; show each hint once; implement the first-opposite slow-mo (time_scale 0.3 with the existing wall-clock-timer pattern).
- **B11 — Phase ring around the ball is missing (§3.4 core readability).** The phase timer lives only in a bottom-of-screen bar; the spec's design has a depleting ring *around the ball* with a 0.5 s pulse warning — that's where the player's eyes are. Add a world-space ring (torus mesh with an angular-fill shader, or a camera-facing quad with a radial shader) attached to the ball, colored by phase, pulsing before the flip. Keep the HUD bar too.
- **B12 — Crate2x on boss levels under-pays.** Boss clear grants +5 crate progress (`game.gd:_on_level_clear`) but the "2× CRATE (AD)" button adds only +1 (`_grant_crate_2x`). "2× progress for that clear" should double the actual gain — store the clear's gain and add that amount. (Generous on bosses is *good*: it's the strongest rewarded-ad moment in the game.)
- **B13 — Harness bot drift.** `tools/harness_bot.gd:_play_once` fever branch has a no-op `if chain >= FEVER_THRESHOLD: fever = true` and doesn't refresh fever grace on shatter; the bot also knows nothing of per-level fever thresholds (B9). Fix alongside C2.

### UX-correctness (small but player-visible)

- **B14 — Never show a button that can't work.** The spec's §3.6 rule is applied to revive only. Apply it everywhere: hide/disable "2× CRATE (AD)" (`hud.gd:show_level_clear`) and the "+2 (Ad)" refill buttons (`prelevel.gd`) when `AdManager.is_rewarded_ready()` is false, and react to readiness changes.
- **B15 — Multiple crates need round-trips through Home.** `scripts/crate_open.gd` opens exactly one; with boss +5 gains a player can hold ≥10 progress. Add an "Open another" button when `Crates.can_open` still holds.
- **B16 — Skins gallery issues.** `scripts/skins_gallery.gd`: no `ScrollContainer` (12 tiles × 150 px + chrome overflows short screens); equipping reloads the entire scene (`_router.go_to_skins()`); locked tiles are `disabled` with no preview. Wrap grid in a ScrollContainer, refresh tiles in place, let locked tiles show a preview popup.
- **B17 — Safe area only insets the top.** `hud.gd:_apply_safe_area` moves top elements only; the phase bar and hint sit near the bottom where gesture-nav bars live. Inset bottom-anchored controls symmetrically from `DisplayServer.get_display_safe_area()`.
- **B18 — Dead code / small smells.** `hud.gd:show_fake_ad` (superseded by the AdManager stub) — delete. `hud.gd:_make_bar` unused parameter. `home.gd:_toast` label is anchored to a point so the text isn't actually centered — give it a width. `AdManager.next_backoff` is currently dead — it becomes live in R4 plugin wiring; leave with a comment pointing at R4.

**Accepts when:** all fixes in place, tests extended to cover B1 (state-machine test), B6 (refund matrix), B9 (fever threshold per level), B12 (boss 2×); full manual pass of every flow on desktop.

---

## 3. Milestone R2 — Refactoring (keep it small, do it while the code is warm)

- **C1 — Single source of truth for sim constants.** `harness_bot.gd` duplicates ~15 physics constants from `game.gd` "with a sync note" — B9/B13 prove the drift risk. Extract a `scripts/sim_params.gd` (`class_name SimParams`, plain consts or a Resource) consumed by both. The bot's fidelity is what makes difficulty tuning trustworthy; it must not drift.
- **C2 — Extract the core simulation.** Go one step further than C1 where cheap: move the pure ball/phase/collision stepping (the shared logic of `game.gd:_resolve_descent`/`_tick_phase`/`_tick_fever` and `harness_bot.gd:_play_once`) into a scene-free `scripts/ball_sim.gd`; `game.gd` drives it and renders, the bot drives it headless. Only do this if it stays a mechanical extraction — do not redesign behavior.
- **C3 — Split `game.gd` (777 lines) along existing seams.** Suggested: `tower_view.gd` (build/pool/rotate platform nodes — created anyway by B2), `fx_director.gd` (shake, hit-stop, slow-mo, flashes, particles), leaving `game.gd` as the run-state controller. Stop there; no deeper decomposition.
- **C4 — UI theme resource.** Replace the per-widget `add_theme_*_override` scatter in `UIKit`/`hud.gd` with one Godot `Theme` (font, font sizes, button styleboxes, colors) applied at `main.tscn` root — this is also the enabler for the R3 visual pass.
- **C5 — Centralize strings.** The spec's "single strings dictionary" (§10) was never implemented; player-facing text is inlined across 8 files. Create `scripts/strings.gd` with a flat `const S := {...}`. English only; structure for future i18n.

**Accepts when:** behavior-identical (bot difficulty report unchanged within noise before/after C1–C3), tests pass, `game.gd` < 450 lines.

---

## 4. Milestone R3 — UI/UX & presentation pass ("store-worthy")

The game currently renders default grey Godot buttons over flat color fills. This milestone is the largest single lever on perceived quality. All items use the C4 theme.

- **D1 — Visual identity.** One custom font (CC0/OFL — e.g. an OFL geometric sans; embed and attribute), neon-styled StyleBoxFlat buttons (rounded, subtle gradient + phase-colored glow border), consistent 8-pt spacing, dark gradient backgrounds matching the current level's theme instead of flat `Color(0.06, 0.04, 0.12)` everywhere.
- **D2 — Screen transitions.** 0.15–0.2 s fade or slide between screens in `main.gd:_swap` (a `CanvasLayer` fader in main). Scene *loads* should also stop hitching: preload `game.tscn` dependencies or show the fader during the synchronous build.
- **D3 — Home screen.** Logo lockup for the title, equipped-skin ball preview (small `SubViewport` with the actual ball material — doubles as a skin-shop advert), crate widget as a progress ring, booster count strip. Keep it one-thumb: PLAY dominates.
- **D4 — In-game juice completion.** Floating "+N" score popups on shatter (pooled Label3D or screen-space labels — pool per §8.4); score count-up tween on the clear screen with a combo-bonus line and a "NEW BEST!" celebration state; phase-flip *forecast* (small icon showing the next color near the phase ring) — this turns deaths from "unfair" to "my fault", the single most important feel property of the genre.
- **D5 — Level-clear / game-over screens.** Restyle with the theme; add "so close" progress readout on death (e.g. "82% — best 91%") using the existing HUD progress value; primary button visual hierarchy (NEXT/RETRY large + colored, HOME quiet).
- **D6 — Crate opening.** Replace the emoji-label reveal with a small staged animation (crate shake → burst using the existing confetti system → reward card with rarity color). Skippable on tap (already implemented — keep).
- **D7 — Screenshot/trailer pass.** After D1–D6, recapture the ≥6 store screenshots and 30 s video per the original P7 asset list (`docs/store/screenshots.md`); the current placeholders predate the visual pass.

**Accepts when:** side-by-side before/after capture looks like a different (real) game; Andrew feel-test checkpoint; 60 fps still holds with all juice on the target device.

---

## 5. Milestone R4 — Ship blockers: device, ads, release

- **Real AdMob wiring.** Implement the `_plugin_*` hooks in `autoload/AdManager.gd` against the poing-studios plugin (verify its current version supports Godot 4.3; if not, follow the fallback rule in handoff §2). Wire load-failure → `next_backoff` retry (currently dead code, B18). Verify UMP consent flow, every placement with Google test IDs, and airplane-mode behavior on device.
- **`targetSdk` verification.** Check the current Play requirement at build time (it ratchets annually; the handoff was written against an older floor) and set it in the export preset.
- **On-device performance validation** of B2/B3 (profiler numbers in `DECISIONS.md`: draw calls, frame time p95 on the Snapdragon-680-class device, memory over a 50-level soak).
- **Release pack refresh** per `docs/RELEASE.md` — unchanged process, new assets from D7.

**Accepts when:** original handoff P5/P6/P7 acceptance criteria all pass on a physical device with this plan's changes included.

---

## 6. Milestone R5 — Features for retention & monetization (v1.1 track)

Prioritized; each is independent and shippable in a point release. Items marked **[OWNER]** need Andrew's sign-off because they touch the handoff §13 "must not change without flagging" list — proceed with the stated default if he doesn't object.

1. **E1 — "Remove Ads" one-time IAP** (already the documented v1.1 candidate). Removes interstitials only; rewarded ads remain (players *want* those). Google Play Billing via a maintained Godot plugin; entitlement in the save file + a `licence check on restore`. Default price tier ~US$2.99. **[OWNER — adds IAP]**
2. **E2 — Daily streak reward (fully local).** First clear of the day grants +1 crate progress, consecutive days ramp (+1/+2/+3 cap). No server, no clock exploits worth fighting (cap the benefit). Cheap, proven retention.
3. **E3 — Level select + replay.** A simple scrolling list/map of cleared levels with best scores; replaying grants crate progress at half rate. Unblocks "farm the fun levels", makes best-scores meaningful, and multiplies rewarded-ad impressions per session. Add per-level **3-star thresholds** (score-based) with star-count crate bonuses if it stays cheap.
4. **E4 — Missions (local achievements).** ~20 data-driven missions ("Smash 500 amber segments", "Trigger Fever 3× in one level", "Clear a boss without hard-bouncing") paying crate progress/boosters. All counters already exist in `lifetime` stats or are one-line additions. Data-driven in `data/` per handoff §0.7.
5. **E5 — Weekly Challenge Tower.** One special level seeded by ISO week number (deterministic, offline, same for every player), with its own best score. Shareable difficulty, zero backend.
6. **E6 — Cosmetic depth.** 6–8 more skins + *trail styles* as a second cosmetic slot; makes crates/jackpots stay exciting for owners of many skins.
7. **E7 — Play Games leaderboards.** Deferred unless Andrew wants it — adds a network SDK and privacy surface. **[OWNER — network/data]** Default: skip.
8. **E8 — Analytics stance.** Current: none (privacy-first, per handoff). Note plainly: without any telemetry, monetization tuning is blind — no D1/D7 retention, no ad-funnel data beyond AdMob's own dashboard. Default: stay SDK-free at launch, revisit post-launch with aggregate-only options. **[OWNER — data collection]**
9. **E9 — Do not add banners.** Reaffirmed: they tank hyper-casual UX and eCPM; the config flag stays off.

---

## 7. Verification (applies to every milestone)

- `godot --headless -s tools/run_tests.gd` and `tools/soak.gd` green in CI on every push.
- Difficulty report generated and compared before/after any change touching gameplay constants, `LevelLibrary`, `TowerGenerator`, or the sim (C1/C2 make this trustworthy).
- Manual desktop checklist per milestone: full loop Home → prelevel → play → death → revive → clear → crate → skins → settings; pause/resume; back gesture on every screen; app-focus loss mid-run.
- Device checkpoints with Andrew at end of R1 (feel), R3 (look), R4 (release candidate) — mirroring the original handoff's cadence.
- Every tuning/design decision appended to `phase-smash/DECISIONS.md`.

## 8. Suggested execution order & sizing

| Milestone | Content | Relative size |
|---|---|---|
| R0 | Boot, first run, tests, tuning, CI | M — mostly debugging unknowns |
| R1 | Bug fixes B1–B18 | M |
| R2 | Refactors C1–C5 | S–M |
| R3 | UI/UX pass D1–D7 | L — biggest quality lever |
| R4 | Ads/device/release | M — device-bound |
| R5 | v1.1 features E1–E6 | L — ship incrementally after launch |

Launch line: end of R4. R5 ships as 1.1.x updates — launching earlier with a smaller, polished game beats delaying for features.
