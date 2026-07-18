class_name Strings
extends RefCounted
## Single dictionary of player-facing text (§10, C5). Previously strings were
## inlined across ~8 screens; centralizing them here is the seam a future i18n
## layer plugs into (swap `S` for a per-locale table, keep the keys). English
## only for launch. Keys are flat and grouped by screen with a prefix.
##
## Format helpers use %-style placeholders so translated strings can reorder them.

const S := {
	# Home
	"app_title": "PHASE SMASH",
	"home_level": "Level %d",
	"home_open_crate": "OPEN CRATE!",
	"home_crate_progress": "Crate  %d / %d",
	"home_exit_toast": "Press back again to exit",
	# Common buttons
	"btn_play": "PLAY",
	"btn_back": "Back",
	"btn_home": "HOME",
	"btn_skins": "Skins",
	"btn_settings": "Settings",
	"btn_next": "NEXT",
	"btn_retry": "RETRY",
	"btn_resume": "RESUME",
	"btn_restart": "RESTART",
	"btn_close": "Close",
	# Settings
	"settings_title": "SETTINGS",
	"settings_music": "Music",
	"settings_sfx": "SFX",
	"settings_haptics": "Haptics",
	"settings_lite_fx": "Lite FX",
	"settings_privacy": "Privacy options",
	"settings_version": "Phase Smash — v%s",
	"settings_audio_credit": "Audio: CC0/CC-BY — see credits",
	# HUD / run
	"hud_intro_hint": "HOLD to smash — release before the color flips",
	"hud_wait_flip": "Wait for the color flip!",
	"paused": "PAUSED",
	"continue_q": "CONTINUE?",
	"watch_ad_revive": "▶ WATCH AD — REVIVE",
	"no_thanks": "No thanks",
	"level_clear": "LEVEL %d CLEAR",
	"game_over": "GAME OVER",
	"score": "Score  %d",
	"best": "Best  %d",
	"crate_2x": "▶ 2× CRATE (AD)",
	"crate_2x_claimed": "2× claimed",
	# Boosters / prelevel
	"boosters_prompt": "Boosters (tap to equip)",
	"booster_refill": "+2 (Ad)",
	# Crate / skins
	"crate_you_got": "YOU GOT",
	"crate_open_another": "Open another",
	"crate_nice": "Nice!",
	"skins_title": "SKINS",
	"skins_unlock_hint": "Unlock with crate shards",
}

## Lookup a key. Returns the key itself if missing so a typo is visible, never a crash.
static func t(key: String) -> String:
	return String(S.get(key, key))

## Lookup + format (printf-style) in one call.
static func f(key: String, args: Array) -> String:
	return t(key) % args
