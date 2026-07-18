# Credits

## Code & design
- Phase Smash game — built to the PHASE_SMASH_HANDOFF.md spec.

## Audio
Music and SFX to be sourced from CC0 / CC-BY libraries (Kenney, FreePD,
OpenGameArt). List each CC-BY track here with title, author, and license link
before release — the in-game credits screen must show these attributions (§6.5).

Exact files the code loads (drop-in, no code change needed — see B4):
- `assets/music/menu.ogg`   — [ ] menu loop
- `assets/music/game.ogg`   — [ ] gameplay loop
- `assets/music/boss.ogg`   — [ ] boss loop
- `assets/music/fever.ogg`  — [ ] additive Fever stem (mixed over game/boss)
- `assets/sfx/<id>.ogg` for each id in `AudioManager.SFX_IDS`:
  shatter, phase_flip, hard_bounce, death, fever, level_clear, ui_tap, crate_open
Keep total music <4 MB OGG; normalize; list each CC-BY track above before release.

## Engine
- Godot Engine 4.3 (MIT).
- Google AdMob + poing-studios Godot AdMob plugin (Android).
