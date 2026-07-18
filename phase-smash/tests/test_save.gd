class_name TestSave
extends RefCounted
## Save round-trip, migration, merge, and corruption-recovery tests (§8.3).

static func run() -> Array:
	var passed := 0
	var failed := 0
	var log: Array[String] = []

	# 1) Round-trip: stringify -> parse -> merge preserves key values.
	var d := SaveManager.default_data()
	d["highest_level"] = 12
	d["settings"]["music"] = false
	var text := JSON.stringify(d)
	var parsed := SaveManager.parse_save(text)
	if parsed["ok"]:
		var restored := SaveManager.merge_defaults(
			SaveManager.migrate(parsed["data"]), SaveManager.default_data())
		if int(restored["highest_level"]) == 12 and restored["settings"]["music"] == false:
			passed += 1; log.append("PASS  round-trip preserves values")
		else:
			failed += 1; log.append("FAIL  round-trip lost values")
	else:
		failed += 1; log.append("FAIL  round-trip: valid save parsed as corrupt")

	# 2) Corruption detection.
	var corrupt_ok := (
		not SaveManager.parse_save("not json{")["ok"]
		and not SaveManager.parse_save("[1,2,3]")["ok"]
		and not SaveManager.parse_save('{"foo":1}')["ok"]
		and SaveManager.parse_save('{"save_version":1}')["ok"])
	if corrupt_ok:
		passed += 1; log.append("PASS  corruption detection")
	else:
		failed += 1; log.append("FAIL  corruption detection")

	# 3) merge_defaults fills missing keys, keeps existing.
	var old := {"save_version": 1, "highest_level": 7, "settings": {"music": false}}
	var merged := SaveManager.merge_defaults(old, SaveManager.default_data())
	if (int(merged["highest_level"]) == 7 and merged["settings"]["music"] == false
			and merged["settings"]["sfx"] == true and merged.has("crate_progress")):
		passed += 1; log.append("PASS  merge_defaults preserves + fills")
	else:
		failed += 1; log.append("FAIL  merge_defaults")

	# 4) migrate bumps version.
	var mg := SaveManager.migrate({"save_version": 0})
	if int(mg["save_version"]) == SaveManager.SAVE_VERSION:
		passed += 1; log.append("PASS  migrate bumps save_version")
	else:
		failed += 1; log.append("FAIL  migrate")

	return [passed, failed, log]
