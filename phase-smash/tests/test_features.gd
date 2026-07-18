class_name TestFeatures
extends RefCounted
## v1.1 feature rules (R5): daily streak (E2), missions (E4), weekly best (E5).
## Pure, no scene tree.

static func run() -> Array:
	var passed := 0
	var failed := 0
	var log: Array[String] = []

	# --- E2: daily streak ramps +1/+2/+3 and caps, resets on a gap. ---
	var d := SaveManager.default_data()
	var b1 := DailyStreak.on_first_clear_today(d, "2026-01-01")
	var b1b := DailyStreak.on_first_clear_today(d, "2026-01-01")  # same day -> 0
	var b2 := DailyStreak.on_first_clear_today(d, "2026-01-02")
	var b3 := DailyStreak.on_first_clear_today(d, "2026-01-03")
	var b4 := DailyStreak.on_first_clear_today(d, "2026-01-04")   # capped at 3
	var b_gap := DailyStreak.on_first_clear_today(d, "2026-01-10")  # gap -> reset to 1
	if b1 == 1 and b1b == 0 and b2 == 2 and b3 == 3 and b4 == 3 and b_gap == 1:
		passed += 1
		log.append("PASS  daily streak %d/%d/%d/%d/%d gap=%d" % [b1, b1b, b2, b3, b4, b_gap])
	else:
		failed += 1
		log.append("FAIL  daily streak %d/%d/%d/%d/%d gap=%d" % [b1, b1b, b2, b3, b4, b_gap])

	# --- E4: mission completes on counter, claim pays crate once. ---
	var dm := SaveManager.default_data()
	dm["lifetime"]["levels_cleared"] = 5
	var m := {"id": "clear_5", "name": "x", "stat": "levels_cleared", "target": 5, "reward": 1}
	var before := int(dm["crate_progress"])
	var claimed_ok := Missions.is_complete(dm, m) and Missions.claim(dm, m)
	var double_claim := Missions.claim(dm, m)  # should fail
	if claimed_ok and not double_claim and int(dm["crate_progress"]) == before + 1 and Missions.is_claimed(dm, "clear_5"):
		passed += 1; log.append("PASS  mission claim pays once")
	else:
		failed += 1; log.append("FAIL  mission claim (ok=%s dbl=%s crate=%d)" % [claimed_ok, double_claim, dm["crate_progress"]])

	# --- E5: weekly best resets on a new week, keeps the max within a week. ---
	var dw := SaveManager.default_data()
	var nb1 := WeeklyChallenge.record_best(dw, "w100", 500)
	var nb2 := WeeklyChallenge.record_best(dw, "w100", 300)  # not a best
	var nb3 := WeeklyChallenge.record_best(dw, "w100", 900)  # new best
	var nb4 := WeeklyChallenge.record_best(dw, "w101", 10)   # new week resets
	if nb1 and not nb2 and nb3 and nb4 and WeeklyChallenge.best_for(dw, "w101") == 10 and WeeklyChallenge.best_for(dw, "w100") == 0:
		passed += 1; log.append("PASS  weekly best tracks per-week")
	else:
		failed += 1; log.append("FAIL  weekly best tracking")

	return [passed, failed, log]
