class_name Boosters
extends RefCounted
## The three free, ad-accelerated boosters (§7.1). Equip max one of each per
## level; consumed on use. Inventory capped at 9 each. This module holds the
## catalog + pure inventory helpers that operate on a SaveManager-shaped dict so
## it's testable without a scene.

const CAP := 9
const IDS := ["shield", "slow_mo", "head_start"]
const FREE_SHIELD_EVERY := 5   # one free shield per 5 clears (§7.1)
const SLOW_MO_FACTOR := 0.7    # tower rotation -30%
const HEAD_START_FRACTION := 0.25

class Info:
	var id: String
	var name: String
	var desc: String

static func info(id: String) -> Info:
	var i := Info.new()
	i.id = id
	match id:
		"shield":
			i.name = "Shield"
			i.desc = "Survive one obsidian hit"
		"slow_mo":
			i.name = "Slow-Mo"
			i.desc = "Tower rotation -30%"
		"head_start":
			i.name = "Head Start"
			i.desc = "Skip the first 25%"
	return i

static func count(data: Dictionary, id: String) -> int:
	return int(data["boosters"].get(id, 0))

static func grant(data: Dictionary, id: String, n: int = 1) -> void:
	data["boosters"][id] = mini(count(data, id) + n, CAP)

static func is_equipped(data: Dictionary, id: String) -> bool:
	return bool(data["equipped"].get(id, false))

## Toggles equip for the next level; can only equip what you own. Returns the
## new equipped state.
static func toggle_equip(data: Dictionary, id: String) -> bool:
	if is_equipped(data, id):
		data["equipped"][id] = false
	elif count(data, id) > 0:
		data["equipped"][id] = true
	return is_equipped(data, id)

## Consumes all equipped boosters at level start; returns the set that was active
## (so the game can apply their effects) and clears the equip flags.
static func consume_equipped(data: Dictionary) -> Dictionary:
	var active := {}
	for id in IDS:
		if is_equipped(data, id) and count(data, id) > 0:
			data["boosters"][id] = count(data, id) - 1
			data["equipped"][id] = false
			active[id] = true
	return active

## Award the periodic free shield if enough clears have accumulated.
static func on_level_clear(data: Dictionary) -> void:
	var c := int(data.get("clears_since_free_shield", 0)) + 1
	if c >= FREE_SHIELD_EVERY:
		c = 0
		grant(data, "shield", 1)
	data["clears_since_free_shield"] = c
