class_name TestProgression
extends RefCounted
## Level-curve + booster-economy rules (§4, §7.1). Covers the per-level Fever
## threshold (B9) and the booster refund matrix (B6). Pure, no scene tree.

static func run() -> Array:
	var passed := 0
	var failed := 0
	var log: Array[String] = []

	# --- B9: Fever threshold is 10 before L30 and 12 from L30 on. ---
	var t29 := LevelLibrary.get_level(29).fever_threshold
	var t30 := LevelLibrary.get_level(30).fever_threshold
	var t50 := LevelLibrary.get_level(50).fever_threshold
	var t80 := LevelLibrary.get_level(80).fever_threshold  # procedural band
	if t29 == 10 and t30 == 12 and t50 == 12 and t80 == 12:
		passed += 1
		log.append("PASS  fever_threshold curve 29=%d 30=%d 50=%d 80=%d" % [t29, t30, t50, t80])
	else:
		failed += 1
		log.append("FAIL  fever_threshold curve 29=%d 30=%d 50=%d 80=%d" % [t29, t30, t50, t80])

	# fever_threshold survives the JSON round-trip (tooling schema, §5.2).
	if LevelLibrary.get_level(30).to_dict().get("fever_threshold", -1) == 12:
		passed += 1; log.append("PASS  fever_threshold present in to_dict()")
	else:
		failed += 1; log.append("FAIL  fever_threshold missing from to_dict()")

	# --- B6: booster refund matrix. ---
	var cases := [
		# [consumed, shield_unpopped, on_restart, expected]
		[{"shield": true}, true, false, ["shield"]],      # unused shield, game-over -> refund
		[{"shield": true}, false, false, []],             # shield popped -> no refund
		[{"slow_mo": true}, false, true, ["slow_mo"]],    # slow-mo, restart -> refund
		[{"slow_mo": true}, false, false, []],            # slow-mo, game-over -> keep consumed
		[{"head_start": true}, true, true, []],           # head-start never refunds
		[{"shield": true, "slow_mo": true}, true, true, ["shield", "slow_mo"]],
	]
	var matrix_ok := true
	for c in cases:
		var got: Array = Boosters.refund_on_end(c[0], c[1], c[2])
		if got != c[3]:
			matrix_ok = false
			log.append("FAIL  refund_on_end(%s, %s, %s) = %s, want %s" % [c[0], c[1], c[2], got, c[3]])
	if matrix_ok:
		passed += 1; log.append("PASS  booster refund matrix (%d cases)" % cases.size())
	else:
		failed += 1

	return [passed, failed, log]
