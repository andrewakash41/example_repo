extends Node
## Global run/session state and cross-scene signals.
## P0: minimal — tracks current level and exposes signals the HUD/flow listen to.
## Later phases add: booster loadout, fever/combo state mirror, run stats.

signal level_started(level_number: int)
signal level_cleared(level_number: int, score: int)
signal ball_died(level_number: int)

## Highest level the player can currently start. Persisted by SaveManager later.
var current_level: int = 1

## Score for the level in progress (reset on level start).
var run_score: int = 0

func start_level(level_number: int) -> void:
	current_level = level_number
	run_score = 0
	level_started.emit(level_number)

func add_score(points: int) -> void:
	run_score += points

func clear_level() -> void:
	level_cleared.emit(current_level, run_score)

func die() -> void:
	ball_died.emit(current_level)

## Advance to the next level and remember the furthest reached.
func advance_level() -> void:
	current_level += 1
	if current_level > int(SaveManager.data["highest_level"]):
		SaveManager.data["highest_level"] = current_level
