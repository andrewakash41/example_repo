class_name Trails
extends RefCounted
## Trail styles (E6, §R5): a second cosmetic slot alongside skins, so crates and
## jackpots stay exciting for players who already own many balls. Cosmetic only —
## a trail tweaks the ball's ribbon width/brightness/colour-blend; the phase
## colour still drives readability. "none" is always owned. Unlocked via crates.

const UNLOCK_EVERY := 10  # a new trail unlocks every N campaign clears

class Trail:
	var id: String
	var name: String
	var width: float          # scale multiplier for the trail ribbon
	var energy: float         # emission energy multiplier
	var phase_tint: float     # 0 = trail's own colour, 1 = full phase colour

static func _t(id: String, name: String, width: float, energy: float, tint: float) -> Trail:
	var t := Trail.new()
	t.id = id
	t.name = name
	t.width = width
	t.energy = energy
	t.phase_tint = tint
	return t

static func all() -> Array:
	return [
		_t("none", "Classic", 1.0, 1.0, 1.0),
		_t("comet", "Comet", 1.4, 1.3, 0.8),
		_t("spark", "Spark", 0.8, 1.6, 1.0),
		_t("ribbon", "Ribbon", 1.8, 0.9, 0.7),
		_t("ghost", "Ghost", 1.2, 0.5, 0.5),
	]

static func get_trail(id: String) -> Trail:
	for t in all():
		if t.id == id:
			return t
	return all()[0]

static func ids() -> Array:
	var out: Array = []
	for t in all():
		out.append(t.id)
	return out

## "none" is always unlocked; the rest unlock progressively with levels cleared,
## so the cosmetic slot keeps giving late-game players something new to chase (E6).
static func is_unlocked(data: Dictionary, id: String) -> bool:
	if id == "none":
		return true
	var idx := ids().find(id)
	if idx < 0:
		return false
	return int(data["lifetime"]["levels_cleared"]) >= idx * UNLOCK_EVERY

static func unlock_level(id: String) -> int:
	return maxi(ids().find(id), 0) * UNLOCK_EVERY
