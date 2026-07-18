class_name TestCrates
extends RefCounted
## Crate weighting distribution + shard/jackpot behavior (§7.2).

static func run() -> Array:
	var passed := 0
	var failed := 0
	var log: Array[String] = []

	# 1) First-open weighting ~ 60% shard / 30% booster / 10% jackpot.
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var counts := {"shard": 0, "booster": 0, "jackpot": 0, "skin": 0}
	var n := 60000
	for i in n:
		var d := SaveManager.default_data()
		d["crate_progress"] = 5
		var res := Crates.open(d, rng)
		counts[res["type"]] = int(counts[res["type"]]) + 1
	var shard_p := float(counts["shard"]) / n
	var booster_p := float(counts["booster"]) / n
	var jackpot_p := float(counts["jackpot"]) / n
	if absf(shard_p - 0.60) < 0.02 and absf(booster_p - 0.30) < 0.02 and absf(jackpot_p - 0.10) < 0.02:
		passed += 1
		log.append("PASS  weighting %.2f/%.2f/%.2f (shard/booster/jackpot)" % [shard_p, booster_p, jackpot_p])
	else:
		failed += 1
		log.append("FAIL  weighting %.2f/%.2f/%.2f" % [shard_p, booster_p, jackpot_p])

	# 2) 5 shards toward one skin -> it becomes owned and shards clear.
	var d2 := SaveManager.default_data()
	d2["shards"]["disco"] = 4
	d2["crate_progress"] = 5
	# Force the shard branch with a seed that rolls >= 0.40 (checked below).
	var minted := false
	for attempt in 200:
		var d := SaveManager.default_data()
		d["shards"] = {"disco": 4}
		d["crate_progress"] = 5
		var r := RandomNumberGenerator.new()
		r.seed = attempt
		var res := Crates.open(d, r)
		if res["type"] == "skin" and res["id"] == "disco":
			minted = d["skins_owned"].has("disco") and not d["shards"].has("disco")
			break
	if minted:
		passed += 1; log.append("PASS  5th disco shard mints the skin")
	else:
		failed += 1; log.append("FAIL  shard->skin conversion")

	# 3) All skins owned: never crashes, always yields a valid reward.
	var d3 := SaveManager.default_data()
	d3["skins_owned"] = Skins.ids().duplicate()
	var ok := true
	for i in 500:
		d3["crate_progress"] = 5
		var res := Crates.open(d3, rng)
		if not res.has("type"):
			ok = false
			break
	if ok:
		passed += 1; log.append("PASS  all-owned crates fall back safely")
	else:
		failed += 1; log.append("FAIL  all-owned crate crashed/invalid")

	return [passed, failed, log]
