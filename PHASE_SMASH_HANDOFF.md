# PHASE SMASH — Implementation Handoff Document

**Document type:** Complete implementation handoff for Claude Opus (executor)
**Owner:** Andrew (solo developer, no game development experience — Opus owns ALL technical decisions and implementation)
**Target:** Google Play Store release, free-to-play, ad-monetized
**Working title:** *Phase Smash* (placeholder — Andrew may rename before store listing; nothing in code should hardcode the name outside one constant)

---

## 0. Rules of Engagement for Opus (READ FIRST)

1. **Do not ask Andrew design questions.** Every design decision is specified below with exact defaults. If something is genuinely unspecified, use the "Tuning Authority" rules in §13 — decide, document the decision in `DECISIONS.md`, and move on.
2. **Only ask Andrew for things he alone can provide:** account credentials, AdMob IDs, keystore passwords, physical device test results, and Play Console actions. These are enumerated in §12.
3. **Never break the one-touch rule.** The entire game must be playable with a single thumb: touch-and-hold, release. No swipes, no second button, no tilt.
4. **Performance is a feature.** 60 fps on a mid-range 2022 Android phone (Snapdragon 680-class, 4 GB RAM) is a hard requirement. If a visual effect costs frames on that tier, cut or fake it.
5. **Ship in phases.** Follow the milestone plan in §11 in order. Each phase has acceptance criteria; do not start the next phase until the current one passes.
6. **All state is local.** No accounts, no cloud saves, no analytics SDKs at launch (owner is privacy-focused). The only third-party network SDK is Google AdMob + UMP consent.
7. **Keep everything data-driven.** Levels, difficulty, skins, booster costs — all in resource/JSON files, never hardcoded in gameplay scripts.

---

## 1. Vision & Positioning

A hyper-casual 3D arcade smasher in the lineage of *Stack Ball 3D* / *Helix Jump*, with one original mechanic (Phase system, §3) that adds a timing/decision layer without adding controls. The pitch in one sentence:

> "Smash down a glowing helix tower — but your ball keeps switching color, and you can only smash what matches."

- **Session length target:** 30–90 seconds per level.
- **Feel targets:** instantly readable, extremely juicy (particles, screen shake, haptics), "one more level" loop.
- **Audience:** global casual players; portrait; offline-playable (ads simply skip when offline).
- **Business model:** 100% free. Interstitial ads between levels + rewarded ads for revives/boosters/crates. **No IAP at launch** (a "Remove Ads" one-time IAP is a documented v1.1 candidate, out of scope now).

---

## 2. Engine Decision (LOCKED)

**Engine: Godot 4 (latest stable 4.x at build time), GDScript, Mobile renderer.**

Rationale (for the record — do not relitigate):
- Godot scenes/scripts are plain text, so an AI executor can build, review, and diff the *entire* project without a human driving an editor GUI. Unity's editor-centric workflow would force Andrew (zero gamedev experience) to perform manual editor steps constantly.
- Headless CLI export to Android AAB is first-class (`godot --headless --export-release`).
- Free, no login, no splash-screen licensing concerns, ~30–40 MB output vs Unity's 60 MB+.
- AdMob is available via the actively maintained **poing-studios Godot AdMob plugin** (verify latest version and Godot compatibility at implementation time).
- The visual bar for this genre (unlit/emissive stylized 3D, particles, glow) is fully achievable in Godot's Mobile renderer.

Fallback: if the AdMob plugin proves broken on the current Godot stable, pin to the newest Godot version the plugin officially supports rather than switching engines.

---

## 3. Core Gameplay Specification

### 3.1 Setup
- **Orientation:** portrait, sensor-portrait locked.
- **Scene:** a vertical helix tower of stacked disc platforms. A ball bounces on the topmost platform. Camera looks down the tower at ~35° from above, following the ball with smoothing.
- The tower **rotates**; the ball's X/Z position is fixed on the tower's forward edge. (Identical spatial model to Stack Ball — proven readable.)

### 3.2 Controls
- **Touch and hold anywhere:** ball smashes downward continuously through platforms.
- **Release:** ball bounces in place on the current platform (idle bounce, ~0.45 s period).
- That is the entire control scheme.

### 3.3 Platforms
Each platform is a flat disc, radius ~2.4 m, thickness ~0.25 m, divided into **8 angular segments** (10 on later levels). Segment types:

| Type | Color/Material | While smashing | While bouncing idle |
|---|---|---|---|
| **Amber** (Phase A) | warm orange emissive | Shatters if ball is in Phase A; hard-stop bounce if Phase B | Ball bounces on it |
| **Azure** (Phase B) | cool cyan emissive | Shatters if ball is in Phase B; hard-stop bounce if Phase A | Ball bounces on it |
| **Obsidian** (deadly) | glossy black w/ red rim glow | **Death** on contact while smashing (unless Fever or Shield) | Ball bounces on it safely |
| **Gap** | empty | Ball falls through freely | Ball falls to next platform |

Segment distribution per platform is level-data-driven (§5). Platforms rotate as a unit with the tower; rotation speed and direction per level, with optional per-platform speed variance on boss levels.

### 3.4 The Phase System (THE original twist)
- The ball is always in **Phase A (amber)** or **Phase B (azure)**. Its material, trail, and light color reflect the phase unmistakably.
- A **phase ring** around the ball depletes over the **phase duration** (default 2.5 s, level-tunable). When it empties, the phase flips with a distinct sound + flash + haptic tick. The ring gives ~0.5 s of visual warning (pulsing) before the flip.
- **Matching segment + smashing:** shatters, +score.
- **Opposite segment + smashing:** ball takes a **hard bounce** — kicked upward ~1.5 platform heights, combo resets to 0, brief 0.2 s input lockout. Not death. This is the core risk/reward: push through now, or release, wait for the flip, then dive.
- **Obsidian + smashing:** death (see 3.6).
- Phase timer **pauses while the ball is airborne between platforms during a smash chain** (so deep dives don't flip mid-chain unfairly) and runs during idle bounces and hard-bounce recovery.

### 3.5 Fever Mode
- Breaking **10 segments** in one uninterrupted hold (no release, no hard bounce) triggers **Fever**.
- In Fever: ball smashes **everything** including Obsidian and opposite-phase segments; ball turns white-hot with a flame trail; music layer intensifies; camera FOV kicks +5°.
- Fever lasts as long as the hold continues **+ 1.5 s grace** after release, then ends.
- A thin fever progress bar fills along the screen edge during a chain so the player can see it coming.

### 3.6 Death & Revive
- Death = smashing into Obsidian without Fever/Shield. Slow-mo 0.4 s, ball shatters, tower dims.
- **Revive offer (once per level):** full-screen "Continue?" with a 5 s countdown ring. Watch rewarded ad → resume at death height, 1.5 s invulnerability, combo preserved. Decline/timeout → level failed → retry screen.
- If no ad is loaded or device is offline, the revive button is hidden (never show a button that can't work).

### 3.7 Level Completion
- The tower base is a **finish pad**. Reaching it = level clear: ball mega-bounces, confetti burst, "LEVEL N CLEAR", score tally with combo bonus, +1 crate progress (§7).
- Post-level screen: Next Level (primary), 2x Crate Progress via rewarded ad (secondary), Home.

### 3.8 Scoring
- +1 per segment shattered; combo multiplier = 1 + (segments in current uninterrupted chain ÷ 10), capped ×5.
- Best score per level and lifetime total stored locally. No leaderboards at launch.

---

## 4. Difficulty & Feel Constants (defaults — Opus may tune ±20% during playtesting, must log changes)

| Constant | Default |
|---|---|
| Gravity (smash descent speed) | 22 m/s terminal, reached in 0.15 s |
| Idle bounce height | 1.2 platform gaps |
| Platform vertical gap | 0.9 m |
| Phase duration | 2.5 s (levels 1–10) → scales down per level data, floor 1.6 s |
| Fever threshold | 10 segments (12 from level 30+) |
| Hard bounce kick | 1.5 platform gaps upward |
| Revives per level | 1 |
| Target frame rate | 60 fps; physics tick 60 Hz |

---

## 5. Level System (LOCKED: Hybrid — handcrafted curve → procedural infinity)

### 5.1 Structure
- **Levels 1–50: handcrafted parameter sets.** Not hand-placed geometry — each level is a data resource the tower generator consumes. Opus authors all 50 with an explicit difficulty curve (see 5.3) and playtests them via the automation harness (§8.6).
- **Level 51+: seeded procedural generation.** Seed = level number, so every player gets identical level N (shareable difficulty, deterministic testing). Parameters interpolate along defined curves with a soft ceiling at level 200; beyond that, difficulty plateaus with cosmetic variety only (hyper-casual retention data says punishing late-game churns players).
- **Boss towers every 10th level (10, 20, 30…):** 1.5× platform count, one or two *independently rotating* platform bands, guaranteed crate reward on clear, distinct color grade (darker sky, gold rim lighting).

### 5.2 Level data schema (Godot custom Resource, exported also as JSON for tooling)
```
level_number: int
platform_count: int            # 25 (L1) → 60 (L50); boss ×1.5
segment_count: int             # 8, or 10 from L25+
rotation_speed_deg: float      # 20 (L1) → 75 (L50), sign alternates every few levels
rotation_variance: float       # boss levels only: per-band multiplier 0.8–1.3
phase_duration: float          # 2.5 → 1.6
obsidian_pct: float            # 0.0 (L1–2) → 0.28 (L50), never >0.35
opposite_pct: float            # 0.15 → 0.40
gap_pct: float                 # 0.10 constant
theme_id: int                  # visual theme index (§6.4)
is_boss: bool
```
Generator guarantees per platform: at least 2 contiguous matching-or-gap segments reachable in each phase (no unwinnable platforms) — enforce with a validation pass that rerolls invalid platforms.

### 5.3 Difficulty curve intent (levels 1–50)
- **L1–3:** tutorial-by-design. Zero obsidian, long phase duration, big matching runs. Contextual hint overlays: "HOLD to smash", "Wait for the color flip!" (first opposite-color encounter, time-slowed to 0.3× the first time only).
- **L4–10:** introduce obsidian sparsely (≤8%), first Fever naturally achievable on L5.
- **L11–30:** steady ramp; alternating rotation directions; phase duration shrinking.
- **L31–50:** near-ceiling values; mastery band. L50 completable by a competent player in ≤5 attempts (verify via harness bot with human-reaction latency of 250 ms).

---

## 6. Art Direction — "very good graphics" on a hyper-casual budget

### 6.1 Style
**Stylized neon-minimal 3D.** No PBR realism. Unlit/emissive materials, strong two-tone phase palette, dark gradient sky, heavy bloom-look achieved cheaply. Reference feel: *Stack Ball*'s clarity + *Beat Saber*'s neon contrast.

### 6.2 Rendering budget (hard rules)
- Godot **Mobile renderer**. WorldEnvironment glow: use the cheapest glow mode at low levels ONLY if it holds 60 fps on the test device; otherwise **fake bloom** with additive billboard sprites on emissive edges (pre-authored halo textures). Decide once in Phase 3 and document.
- No real-time shadows. Fake ball shadow = soft dark decal quad under ball.
- Segment shatter = pre-fragmented mesh (6–8 chunks) swapped in on break, chunks are pooled rigid-body-lite (manual velocity + gravity in script, no physics bodies), lifetime 0.8 s, fade-out shader.
- Particles: GPUParticles3D, ≤3 systems alive concurrently (trail, shatter burst, fever flame). Confetti on level clear may spike briefly.
- Draw calls target < 60 in gameplay. Platforms share materials by segment type (4 materials total per theme).

### 6.3 Juice checklist (all mandatory, all cheap)
- Screen shake on every shatter (2 px, 0.05 s) scaling with combo; big shake on Fever start.
- Hit-stop: 30 ms freeze on hard bounce and death.
- Haptics via Godot `Input.vibrate_handheld`: light tick per shatter (throttled to ≥50 ms apart), medium on phase flip, heavy on death/level clear. Global toggle in settings.
- Camera: subtle FOV push while smashing (+3°), smooth follow with 0.08 s lag.
- Ball trail: ribbon trail colored by phase, doubles in width during Fever.
- UI animations: everything tweens (scale-pop buttons, count-up score).

### 6.4 Themes
5 visual themes cycling every 10 levels (sky gradient + platform palette + finish pad style): Dusk Neon, Deep Ocean, Magma Core, Violet Void, Arctic Glow. Amber/Azure/Obsidian must remain unmistakably readable in every theme — themes recolor *ambience*, never the semantic segment hues (allowed drift: ±10% hue).

### 6.5 Audio
- Music: 2 loops (menu, gameplay) + Fever intensity layer (additive stem). Source from CC0/CC-BY (Kenney, FreePD, OpenGameArt); attribute in credits screen. Keep total audio < 4 MB OGG.
- SFX set: shatter (3 pitch variants), phase flip, hard bounce, death, fever ignite, level clear fanfare, UI tap, crate open. CC0 sources; normalize levels.
- Mute toggles (music/SFX separate) in settings; respect device silent mode on Android via stream type.

---

## 7. Meta-Game: Boosters, Crates, Skins (all free, ad-accelerated)

### 7.1 Boosters (equip max one of each per level, consumed on use)
| Booster | Effect | Acquisition |
|---|---|---|
| **Shield** | Survive one obsidian hit (pops with effect) | 1 free per 5 level-clears, or rewarded ad (+2) |
| **Slow-Mo** | Tower rotation −30% for the level | Rewarded ad (+2), occasional crate drop |
| **Head Start** | Auto-clear first 25% of tower with fever visuals | Rewarded ad (+2), crate drop |
Inventory capped at 9 each. Pre-level screen shows the three slots with counts; tap to equip.

### 7.2 Crates
- Crate progress: +1 per level clear; crate opens at 5. Post-level rewarded ad = "2× progress" for that clear.
- Boss clears grant an instant crate.
- Crate contents (weighted): skin shard 60% (5 shards = a skin, targeted at the nearest incomplete skin), boosters 30%, "jackpot" full skin 10%.
- Opening animation: 1.5 s, skippable after first view.

### 7.3 Skins (cosmetic only)
12 ball skins at launch (materials/trails: e.g., Comet, Disco, Lava Core, Plasma, Eyeball, Bubble). Phase colors always tint the skin so readability survives. Skin picker on home screen.

---

## 8. Technical Architecture

### 8.1 Project layout
```
res://
  autoload/    GameState.gd, SaveManager.gd, AdManager.gd,
               AudioManager.gd, Haptics.gd, LevelLoader.gd
  scenes/      main.tscn, home.tscn, game.tscn, ball.tscn,
               platform.tscn, tower.tscn, ui/*.tscn (hud, pause,
               level_clear, game_over, revive, crate, settings, skins)
  scripts/     mirrors scenes; tower_generator.gd, level_validator.gd
  data/        levels/level_001.tres … level_050.tres, themes/*.tres,
               skins/*.tres, boosters.tres, ad_config.tres
  assets/      materials/, meshes/, sfx/, music/, textures/, fonts/
  tools/       harness_bot.gd (headless playtest bot), level_report.gd
  DECISIONS.md
```

### 8.2 State & flow
- `main.tscn` is a thin root that swaps Home/Game scenes. Overlays are CanvasLayer children, never scene reloads mid-run (revive must resume in-place).
- Pause on app focus loss (`NOTIFICATION_APPLICATION_PAUSED`) — auto-pause menu, never death by phone call.

### 8.3 Save system
- Single JSON at `user://save.json`, written atomically (temp + rename) on: level clear, crate open, booster change, settings change, app pause.
- Contents: highest level unlocked, per-level best score, lifetime stats, booster inventory, shards/skins owned + equipped, crate progress, settings, ad frequency timestamps, consent status flag.
- Versioned (`save_version`) with a migration stub. Corrupt file → back it up to `save.bak`, start fresh, toast the player.

### 8.4 Performance engineering
- Object pools: platforms (pool 12; recycle as ball descends — only ~8 visible), shatter chunks, particle bursts, floating score labels.
- Tower is generated top-down lazily: instantiate platforms just below camera view, free ones above.
- Zero per-frame allocations in gameplay scripts (preallocate arrays, no string building in `_process`).
- Physics: ball is the only physics-driven body; segments use area/shape queries, chunks are scripted. Keep the physics tree tiny.
- Test matrix: 60 fps on mid-range (Snapdragon 680-class), acceptable 30+ fps floor on 2 GB devices with an auto "Lite FX" mode (glow off, half particles) triggered when average frame time > 20 ms for 5 s; also exposed as a settings toggle.

### 8.5 Android specifics
- `minSdk 26` (Android 8.0), `targetSdk` = **whatever Google Play currently requires at build time — verify before export** (requirements ratchet annually).
- Handle display cutouts/edge-to-edge; HUD respects safe area.
- Back gesture: pause in gameplay, back-navigation in menus, double-back-to-exit on home.
- App size goal < 50 MB AAB.

### 8.6 Test & tuning harness
- `harness_bot.gd`: headless bot that plays levels with configurable reaction latency (default 250 ms) and a simple policy (dive when ≥2 matching segments approach alignment; release when opposite/obsidian imminent). Outputs per-level: clear rate over 20 runs, avg attempts, avg duration, death causes.
- CI-style script runs the bot across all 50 levels and prints a difficulty report; Opus uses this to tune level data until the curve targets in §5.3 hold. This substitutes for the human playtesting Andrew can't do at scale — Andrew does *feel* testing only.
- GUT (Godot Unit Test) or plain script tests for: tower generator validity (no unwinnable platforms across 10k seeds), save round-trip + corruption recovery, ad frequency-cap logic (pure functions, easily testable), crate weighting distribution.

---

## 9. Monetization: AdMob Integration

### 9.1 SDK & consent
- **Google AdMob** via the poing-studios Godot AdMob plugin (Android). Use **Google test ad unit IDs** for the entire development cycle; real IDs are injected via `data/ad_config.tres` at release (Andrew provides, §12).
- **UMP (User Messaging Platform) consent flow** on first launch for EEA/UK users, with "Privacy options" entry in Settings to revisit. Non-personalized ads when consent is declined. This is legally required — do not skip.
- Declare the AdMob app ID in the Android manifest via the plugin's documented mechanism.

### 9.2 Ad placements & caps (exact policy — implement as data in `ad_config.tres`)
| Placement | Type | Trigger | Caps |
|---|---|---|---|
| Post-level interstitial | Interstitial | After level-clear screen "Next" tap | Not before level 4 complete; ≥90 s since last interstitial; ≥1 level since last; **never** within 30 s after any rewarded ad; skipped if a rewarded ad was watched that level |
| Revive | Rewarded | Player taps Continue on death | Max 1/level |
| 2× crate progress | Rewarded | Post-level button | Max 1/level |
| Booster refill | Rewarded | Booster slot "+" on pre-level screen | Max 6 rewarded ads/day total across placements 3–4 (soft daily cap to protect eCPM) |
| Crate open boost | Rewarded | Optional "open now" if crate progress ≥3 | counts toward daily cap |
| Banner | — | **None at launch.** Code path exists behind a config flag, default off | — |

- Preload: interstitial + one rewarded kept loaded; reload on close/failure with exponential backoff (5 s → 60 s). All ad calls fail silent — gameplay never blocks on ads, offline play fully functional.
- **Policy compliance:** ads only at natural breaks; no ads behind misleading buttons; revive countdown is honest; comply with AdMob's interstitial guidance (no unexpected full-screens). This protects the AdMob account from suspension — treat as non-negotiable.

### 9.3 First-session protection
No interstitials in the first session's first 4 levels regardless of timing — day-1 retention outranks day-1 revenue.

---

## 10. Screens & UX inventory
1. **Splash** (Godot boot + 1 s logo) → Home.
2. **Home:** big PLAY (continues at next uncleared level), level number, skin button, settings gear, crate progress widget, booster inventory strip.
3. **Pre-level:** level number, theme preview, 3 booster slots, PLAY.
4. **HUD:** level progress bar (tower % descended) top, score + combo top-right, fever bar edge, pause button.
5. **Pause:** resume / restart / home / sound toggles.
6. **Death → Revive → Game Over:** as §3.6; game over shows score, best, Retry (primary), Home.
7. **Level clear:** as §3.7.
8. **Crate open**, **Skins gallery**, **Settings** (music, SFX, haptics, Lite FX, privacy options, credits, privacy policy link, version).
9. First-launch: UMP consent (region-dependent) → straight into Level 1 (no menus before first play — hyper-casual convention: Home appears from level 2 onward... **Decision locked:** first launch auto-starts Level 1 after consent).

All text in a single `strings` dictionary (English only at launch, structured for future i18n).

---

## 11. Milestones for Opus (execute in order)

**P0 — Scaffold (foundation)**
Project setup, autoload skeletons, main scene routing, greybox tower + ball with hold-to-smash and idle bounce, camera follow.
✓ *Accepts when:* playable greybox descends a 30-platform tower at 60 fps in editor; segments shatter (no phases yet).

**P1 — Core mechanic complete**
Phase system + ring UI, segment types with all four interactions, hard bounce, Fever, death, level-clear flow, scoring/combo. Revive flow with a stubbed "fake ad" dialog.
✓ *Accepts when:* one full level is genuinely fun in a hands-on test; all §3 behaviors verifiable; harness bot can clear it.

**P2 — Level system**
Generator + validator, level resource schema, all 50 handcrafted level datasets, procedural mode 51+, boss towers, difficulty tuned via harness reports until §5.3 targets pass.
✓ *Accepts when:* bot report shows monotonic-ish difficulty, no unwinnable platforms in 10k seeds, L50 target met.

**P3 — Art, juice, audio**
Full §6: materials, themes, shatter chunks, particles, trail, shake/hit-stop/haptics, all SFX/music, Lite FX mode, real HUD/menu visual design.
✓ *Accepts when:* capture footage looks store-worthy; 60 fps holds on target device (Andrew tests, §12).

**P4 — Meta-game & persistence**
Boosters, crates, skins, save system + migrations + corruption recovery, settings, all screens final.
✓ *Accepts when:* full loop (play→earn→equip) works across app restarts; save tests pass.

**P5 — Ads & consent**
AdMob plugin with test IDs, UMP flow, all placements + caps from §9 (cap logic unit-tested), offline behavior verified.
✓ *Accepts when:* test ads show on device in every placement; caps provably enforced; airplane-mode run is clean.

**P6 — Hardening**
Profiling on device, memory soak (50 consecutive levels, no growth), pause/focus/rotation/cutout edge cases, back-gesture audit, app icon + adaptive icon, crash-free 30-minute session.

**P7 — Release**
Keystore, release AAB export, versioning scheme (versionCode auto-increment), store asset pack: icon 512, feature graphic 1024×500, ≥6 phone screenshots (captured from the game, framed), 30 s gameplay video capture, store listing copy (title ≤30 chars, short + full description with keyword-conscious but honest text), privacy policy document (template for Andrew to host), Play Data Safety form answer sheet (AdMob data collection: device IDs/ad interaction — fill per current AdMob disclosure guidance), content rating questionnaire answer sheet.
✓ *Accepts when:* AAB installs and runs from a release build on Andrew's device; every Play Console input Andrew needs exists as a prepared artifact.

---

## 12. Andrew's Manual Task List (the ONLY things Opus asks him for)

| # | Task | When |
|---|---|---|
| 1 | Google Play Console developer account ($25 one-time). **Note:** new personal accounts must run a closed test with a minimum tester count for a required duration before production access — check current Play policy and start recruiting testers (friends/family, Reddit tester-exchange communities) EARLY, at P4. | Before P7 |
| 2 | AdMob account, create app, create ad units (1 interstitial, 1 rewarded), link to Play listing later; provide App ID + unit IDs | During P5 (dev uses test IDs until then) |
| 3 | Host the privacy policy (GitHub Pages is fine — Opus provides the HTML) and give the URL | P7 |
| 4 | Generate/back up the upload keystore (Opus provides the exact `keytool` command; Andrew stores passwords in his password manager — **loss is unrecoverable**) | P7 |
| 5 | Physical device feel-testing at P1, P3, P5, P6 checkpoints (Opus provides a short test script each time) | Ongoing |
| 6 | Play Console clicking: create app, upload AAB to internal testing, fill Data Safety/content rating from Opus's answer sheets, closed test, production rollout | P7 |
| 7 | Optional rename of "Phase Smash" before listing | Before P7 |

---

## 13. Tuning Authority & Change Control

- **Opus MAY freely tune:** all §4 constants ±20%, level data, crate weights, juice intensities, colors within readability rules, SFX choices. Log every change in `DECISIONS.md` with one-line rationale.
- **Opus MUST NOT change without flagging to Andrew:** the one-touch control scheme, the Phase mechanic's core rules, ad placement *types* or the addition of banners, minSdk, anything adding network calls or data collection, adding IAP.
- **Out of scope for v1.0 (do not build):** leaderboards, cloud save, accounts, IAP, iOS, tournaments, daily-login calendars, push notifications, analytics SDKs, localization beyond English.

---

## 14. Definition of Done (v1.0)
A release-signed AAB that: runs 60 fps on a mid-range device, contains 50 tuned levels + infinite procedural + boss towers + 12 skins + 3 boosters + crates, serves compliant AdMob test ads in all placements with UMP consent, survives a 30-minute crash-free soak, plays fully offline, and ships with a complete Play Console asset/answer pack — such that Andrew's remaining work is purely account administration and clicking through the Play Console.
