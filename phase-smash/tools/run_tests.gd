extends SceneTree
## Headless test + difficulty-report runner. Run with:
##   godot --headless -s tools/run_tests.gd
## Runs the generator tests, then prints a harness-bot difficulty report for
## levels 1-50 so the §5.3 curve targets can be checked and tuned. Exits non-zero
## if any test fails.

func _initialize() -> void:
	var failed_total := 0

	print("\n=== Tests ===")
	var res := TestTowerGenerator.run()
	var passed: int = res[0]
	var failed: int = res[1]
	for line in res[2]:
		print("  ", line)
	print("  -> %d passed, %d failed" % [passed, failed])
	failed_total += failed

	print("\n=== Difficulty report (harness bot, 20 runs/level) ===")
	print("  lvl  boss  clear%  attempts  dur(s)  obs_deaths")
	var report_levels := [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 100]
	for n in report_levels:
		var level := LevelLibrary.get_level(n)
		var s := HarnessBot.simulate_level(level, 20, 0.25)
		print("  %3d   %s   %5.0f   %6.2f   %5.1f   %d" % [
			n,
			"Y" if s["is_boss"] else "-",
			s["clear_rate"] * 100.0,
			s["avg_attempts"] if s["avg_attempts"] != INF else -1.0,
			s["avg_duration"],
			s["death_obsidian"],
		])

	print("\n=== §5.3 spot check ===")
	var l50 := HarnessBot.simulate_level(LevelLibrary.get_level(50), 20, 0.25)
	var l50_ok: bool = l50["avg_attempts"] != INF and l50["avg_attempts"] <= 5.0
	print("  L50 completable in <=5 attempts by 250ms-latency bot: %s (avg %.2f)" % [
		"YES" if l50_ok else "NO", l50["avg_attempts"]])

	print("\nDONE. tests_failed=%d" % failed_total)
	quit(1 if failed_total > 0 else 0)
