extends SceneTree
## Headless soak proxy (§6 P6). Runs the harness bot across 50 consecutive levels
## and reports orphan-node count, as a stability/leak smoke test that can run in
## CI without a device. A TRUE memory soak (50 real scene loads, RSS flat over 30
## min) is an on-device profiling task and is tracked separately in DECISIONS.md.
## Run with:  godot --headless -s tools/soak.gd

func _initialize() -> void:
	var orphans_before := Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT)
	var cleared := 0
	var total_segments := 0

	for n in range(1, 51):
		var level := LevelLibrary.get_level(n)
		# Exercise generation (validator + reroll) and a full bot playthrough.
		var platforms := TowerGenerator.build(level)
		for row in platforms:
			total_segments += row.size()
		var res := HarnessBot.simulate_level(level, 3, 0.25)
		if res["clear_rate"] > 0.0:
			cleared += 1
		print("  L%2d  clear=%3.0f%%  attempts=%.2f" % [
			n, res["clear_rate"] * 100.0,
			res["avg_attempts"] if res["avg_attempts"] != INF else -1.0])

	var orphans_after := Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT)
	print("\nsoak: %d/50 levels clearable, %d segments generated" % [cleared, total_segments])
	print("orphan nodes: before=%d after=%d (delta=%d)" % [
		orphans_before, orphans_after, orphans_after - orphans_before])
	# Orphans must not accumulate across the run.
	quit(0 if orphans_after - orphans_before == 0 else 1)
