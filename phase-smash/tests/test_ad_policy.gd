class_name TestAdPolicy
extends RefCounted
## Ad frequency-cap tests (§9.2) — proves the caps are enforced.

static func _base() -> Dictionary:
	return {
		"level_number": 5, "now": 1000.0,
		"last_interstitial_time": 0.0, "last_interstitial_level": 0,
		"last_rewarded_time": 0.0, "rewarded_watched_this_level": false,
		"is_first_session": false, "levels_completed_this_session": 20,
		"consent_ok": true,
	}

static func run() -> Array:
	var passed := 0
	var failed := 0
	var log: Array[String] = []
	var cfg := AdConfig.new()

	var cases := {
		"baseline allows": [_base(), true],
		"level<4 blocks": [_with("level_number", 3), false],
		"level==4 allows": [_with("level_number", 4), true],
		"interval 89s blocks": [_with("last_interstitial_time", 1000.0 - 89.0), false],
		"interval 90s allows": [_with("last_interstitial_time", 1000.0 - 90.0), true],
		"same-level gap blocks": [_with("last_interstitial_level", 5), false],
		"1-level gap allows": [_with("last_interstitial_level", 4), true],
		"29s after rewarded blocks": [_with("last_rewarded_time", 1000.0 - 29.0), false],
		"30s after rewarded allows": [_with("last_rewarded_time", 1000.0 - 30.0), true],
		"rewarded-this-level skips": [_with("rewarded_watched_this_level", true), false],
		"consent declined blocks": [_with("consent_ok", false), false],
	}
	for name in cases:
		var st: Dictionary = cases[name][0]
		var want: bool = cases[name][1]
		var got := AdPolicy.can_show_interstitial(st, cfg)
		_check(got == want, "interstitial: " + name, passed, failed, log)
		if got == want: passed += 1
		else: failed += 1

	# First session's first 4 levels: never, regardless of timing (§9.3).
	var fs_ok := true
	for lvl in range(1, 5):
		var s := _base()
		s["level_number"] = lvl
		s["is_first_session"] = true
		s["levels_completed_this_session"] = lvl
		if AdPolicy.can_show_interstitial(s, cfg):
			fs_ok = false
	if fs_ok: passed += 1
	else: failed += 1
	log.append(("PASS" if fs_ok else "FAIL") + "  first-session first 4 levels blocked")

	# Rewarded daily cap on placements 4-5.
	var cap_ok := true
	for c in range(0, cfg.daily_rewarded_cap):
		if not AdPolicy.can_show_rewarded(AdConfig.Placement.BOOSTER_REFILL, c, cfg):
			cap_ok = false
	if AdPolicy.can_show_rewarded(AdConfig.Placement.BOOSTER_REFILL, cfg.daily_rewarded_cap, cfg):
		cap_ok = false
	# Revive/2x-crate are not daily-capped here.
	if not AdPolicy.can_show_rewarded(AdConfig.Placement.REVIVE, 999, cfg):
		cap_ok = false
	if cap_ok: passed += 1
	else: failed += 1
	log.append(("PASS" if cap_ok else "FAIL") + "  rewarded daily cap on placements 4-5")

	# Daily rollover.
	var rolled := AdPolicy.rolled_daily({"date": "2026-07-17", "rewarded_count": 6}, "2026-07-18")
	var kept := AdPolicy.rolled_daily({"date": "2026-07-18", "rewarded_count": 3}, "2026-07-18")
	if int(rolled["rewarded_count"]) == 0 and int(kept["rewarded_count"]) == 3:
		passed += 1; log.append("PASS  daily counter rolls over on date change")
	else:
		failed += 1; log.append("FAIL  daily rollover")

	return [passed, failed, log]

static func _with(key: String, value) -> Dictionary:
	var s := _base()
	s[key] = value
	return s

static func _check(ok: bool, name: String, _p: int, _f: int, log: Array[String]) -> void:
	log.append(("PASS  " if ok else "FAIL  ") + name)
