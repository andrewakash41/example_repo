extends Node
## Global run/session state and cross-scene signals.
## P0: minimal — tracks current level and exposes signals the HUD/flow listen to.
## Later phases add: booster loadout, fever/combo state mirror, run stats.

signal level_started(level_number: int)
signal level_cleared(level_number: int, score: int)
signal ball_died(level_number: int)

## Highest level the player can currently start. Persisted by SaveManager later.
var current_level: int = 1

## Weekly Challenge mode (E5): when set, the game loads `weekly_level` instead of
## the campaign level and records the score against the weekly best, not progress.
var weekly_mode: bool = false
var weekly_level: LevelData = null

## Replay mode (E3): replaying an already-cleared level. Best score still records,
## but crate progress is half-rate and campaign progression does not advance.
var replay_mode: bool = false

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
