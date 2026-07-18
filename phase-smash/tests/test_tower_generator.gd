class_name TestTowerGenerator
extends RefCounted
## Plain-script tests for the tower generator (§8.6 asks for generator-validity
## coverage). Invoked by tools/run_tests.gd. Returns [passed, failed, log_lines].
## No GUT dependency so it runs from a bare headless Godot.

static func run() -> Array:
	var passed := 0
	var failed := 0
	var log: Array[String] = []

	# 1) Every platform of every level 1..200 is winnable after build.
	var invalid := 0
	var forced_levels := 0
	for n in range(1, 201):
		var level := LevelLibrary.get_level(n)
		var platforms := TowerGenerator.build(level)
		for p in platforms:
			if not TowerGenerator.is_platform_valid(p, level.segment_count):
				invalid += 1
	if invalid == 0:
		passed += 1
		log.append("PASS  levels 1..200: no unwinnable platforms")
	else:
		failed += 1
		log.append("FAIL  levels 1..200: %d unwinnable platforms" % invalid)

	# 2) Hardest band stress: 10k seeds, all platforms valid.
	var stress_bad := 0
	for seed in range(10000):
		var lvl := LevelLibrary.get_level(50)
		lvl.seed_value = seed
		var platforms := TowerGenerator.build(lvl)
		for p in platforms:
			if not TowerGenerator.is_platform_valid(p, lvl.segment_count):
				stress_bad += 1
	if stress_bad == 0:
		passed += 1
		log.append("PASS  L50 x10k seeds: no unwinnable platforms")
	else:
		failed += 1
		log.append("FAIL  L50 x10k seeds: %d unwinnable platforms" % stress_bad)

	# 3) Determinism: same seed -> identical tower.
	var a := TowerGenerator.build(LevelLibrary.get_level(37))
	var b := TowerGenerator.build(LevelLibrary.get_level(37))
	if str(a) == str(b):
		passed += 1
		log.append("PASS  determinism: level 37 reproducible")
	else:
		failed += 1
		log.append("FAIL  determinism: level 37 differs across builds")

	# 4) The validator actually rejects a hand-made unwinnable platform.
	# All-obsidian has no safe pair in either phase.
	var bad := [PSTypes.Seg.OBSIDIAN, PSTypes.Seg.OBSIDIAN, PSTypes.Seg.OBSIDIAN,
		PSTypes.Seg.OBSIDIAN, PSTypes.Seg.OBSIDIAN, PSTypes.Seg.OBSIDIAN,
		PSTypes.Seg.OBSIDIAN, PSTypes.Seg.OBSIDIAN]
	if not TowerGenerator.is_platform_valid(bad, 8):
		passed += 1
		log.append("PASS  validator rejects all-obsidian platform")
	else:
		failed += 1
		log.append("FAIL  validator accepted an unwinnable platform")

	return [passed, failed, log]
