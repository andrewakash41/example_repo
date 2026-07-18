class_name WeeklyChallenge
extends RefCounted
## Weekly Challenge Tower (E5, §R5). One special level whose layout is seeded by
## the ISO-ish week number, so it is deterministic, fully offline, and identical
## for every player that week — a shareable difficulty with zero backend. Its own
## best score is tracked separately from campaign progress.

const ANCHOR_LEVEL := 40  # difficulty anchor (a boss tower, for spectacle)

## Week bucket key from a unix time — epoch-aligned 7-day windows, same for all.
static func week_key(now_unix: float) -> String:
	return "w%d" % int(now_unix / (86400.0 * 7.0))

## The challenge level for a given week key: the anchor difficulty with a
## week-varying seed so the tower reshuffles weekly but stays fixed within a week.
static func level_for_week(key: String) -> LevelData:
	var d := LevelLibrary.get_level(ANCHOR_LEVEL)
	d.seed_value = absi(hash(key))
	return d

## Records a run's score against the current week's best (resetting on a new
## week). Returns true if it's a new weekly best. Mutates data["weekly"].
static func record_best(data: Dictionary, key: String, score: int) -> bool:
	var w: Dictionary = data["weekly"]
	if String(w.get("week", "")) != key:
		w["week"] = key
		w["best"] = 0
	if score > int(w.get("best", 0)):
		w["best"] = score
		return true
	return false

static func best_for(data: Dictionary, key: String) -> int:
	var w: Dictionary = data["weekly"]
	return int(w.get("best", 0)) if String(w.get("week", "")) == key else 0
