extends Node
## Local persistence. P0: skeleton with an in-memory store and the public API
## the rest of the game will call. Real atomic JSON at user://save.json,
## versioning + migration + corruption recovery land in P4 (§8.3).

const SAVE_PATH := "user://save.json"
const SAVE_VERSION := 1

## In-memory mirror of persisted state. Shape is intentionally close to the
## final save schema so callers written now don't change later.
var data: Dictionary = {
	"save_version": SAVE_VERSION,
	"highest_level": 1,
	"best_scores": {},        # {level_number(str): best_score}
	"lifetime": {"levels_cleared": 0, "segments_smashed": 0},
	"settings": {"music": true, "sfx": true, "haptics": true, "lite_fx": false},
}

func get_best_score(level_number: int) -> int:
	return int(data["best_scores"].get(str(level_number), 0))

func record_best_score(level_number: int, score: int) -> void:
	var key := str(level_number)
	if score > get_best_score(level_number):
		data["best_scores"][key] = score

## No-op persistence for P0 (keeps the call sites honest). Real write in P4.
func flush() -> void:
	pass
