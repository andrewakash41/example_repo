class_name Missions
extends RefCounted
## Local achievements (E4, §R5). ~20 data-driven missions that pay out crate
## progress when claimed. Progress is read from the persistent counters that
## already exist in `lifetime` / `lifetime_ext`, so tracking is free — no per-run
## bookkeeping. Pure/testable; the missions screen just renders these.

## Each: id, name, stat key, target, crate reward. `stat` is looked up in
## data["lifetime"] then data["lifetime_ext"].
const LIST := [
	{"id": "smash_100", "name": "Smash 100 segments", "stat": "segments_smashed", "target": 100, "reward": 1},
	{"id": "smash_500", "name": "Smash 500 segments", "stat": "segments_smashed", "target": 500, "reward": 2},
	{"id": "smash_2000", "name": "Smash 2000 segments", "stat": "segments_smashed", "target": 2000, "reward": 4},
	{"id": "clear_5", "name": "Clear 5 levels", "stat": "levels_cleared", "target": 5, "reward": 1},
	{"id": "clear_25", "name": "Clear 25 levels", "stat": "levels_cleared", "target": 25, "reward": 2},
	{"id": "clear_50", "name": "Clear 50 levels", "stat": "levels_cleared", "target": 50, "reward": 3},
	{"id": "clear_100", "name": "Clear 100 levels", "stat": "levels_cleared", "target": 100, "reward": 5},
	{"id": "fever_3", "name": "Trigger Fever 3 times", "stat": "fever_triggers", "target": 3, "reward": 1},
	{"id": "fever_15", "name": "Trigger Fever 15 times", "stat": "fever_triggers", "target": 15, "reward": 2},
	{"id": "fever_50", "name": "Trigger Fever 50 times", "stat": "fever_triggers", "target": 50, "reward": 4},
	{"id": "boss_1", "name": "Beat a boss tower", "stat": "bosses_cleared", "target": 1, "reward": 1},
	{"id": "boss_5", "name": "Beat 5 boss towers", "stat": "bosses_cleared", "target": 5, "reward": 3},
	{"id": "boss_10", "name": "Beat 10 boss towers", "stat": "bosses_cleared", "target": 10, "reward": 5},
]

static func _stat(data: Dictionary, key: String) -> int:
	if data["lifetime"].has(key):
		return int(data["lifetime"][key])
	return int(data["lifetime_ext"].get(key, 0))

static func progress(data: Dictionary, m: Dictionary) -> int:
	return mini(_stat(data, m["stat"]), int(m["target"]))

static func is_complete(data: Dictionary, m: Dictionary) -> bool:
	return _stat(data, m["stat"]) >= int(m["target"])

static func is_claimed(data: Dictionary, id: String) -> bool:
	return data["missions_claimed"].has(id)

## How many completed-but-unclaimed missions there are — for a Home badge.
static func claimable_count(data: Dictionary) -> int:
	var n := 0
	for m in LIST:
		if is_complete(data, m) and not is_claimed(data, m["id"]):
			n += 1
	return n

## Claims a completed mission: grants its crate reward and marks it claimed.
## Returns true if the claim happened. Does NOT save — the caller persists.
static func claim(data: Dictionary, m: Dictionary) -> bool:
	if not is_complete(data, m) or is_claimed(data, m["id"]):
		return false
	data["crate_progress"] = int(data["crate_progress"]) + int(m["reward"])
	data["missions_claimed"].append(m["id"])
	return true
