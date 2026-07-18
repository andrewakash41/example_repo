class_name Crates
extends RefCounted
## Crate progression + weighted rewards (§7.2). Progress +1 per clear, opens at
## 5. Contents: skin shard 60% (5 shards -> a skin, targeted at the nearest
## incomplete skin), boosters 30%, jackpot full skin 10%. Pure functions over a
## SaveManager-shaped dict so the weighting is unit-testable.

const CRATE_COST := 5
const P_JACKPOT := 0.10
const P_BOOSTER := 0.30   # 0.10..0.40
# remainder (0.40..1.0) -> shard, 60%

static func can_open(data: Dictionary) -> bool:
	return int(data.get("crate_progress", 0)) >= CRATE_COST

## Opens one crate, mutating `data`. Returns a result dict:
##   {type: "shard"|"skin"|"booster"|"jackpot", id: ..., count: ...}
static func open(data: Dictionary, rng: RandomNumberGenerator) -> Dictionary:
	data["crate_progress"] = int(data["crate_progress"]) - CRATE_COST
	var roll := rng.randf()
	if roll < P_JACKPOT:
		return _jackpot(data, rng)
	elif roll < P_JACKPOT + P_BOOSTER:
		return _booster(data, rng)
	return _shard(data, rng)

static func _shard(data: Dictionary, rng: RandomNumberGenerator) -> Dictionary:
	var target := _nearest_incomplete_skin(data)
	if target == "":
		return _booster(data, rng)  # everything owned — fall back
	var have := int(data["shards"].get(target, 0)) + 1
	if have >= 5:
		data["shards"].erase(target)
		if not data["skins_owned"].has(target):
			data["skins_owned"].append(target)
		return {"type": "skin", "id": target}
	data["shards"][target] = have
	return {"type": "shard", "id": target, "count": have}

static func _booster(data: Dictionary, rng: RandomNumberGenerator) -> Dictionary:
	var id: String = Boosters.IDS[rng.randi_range(0, Boosters.IDS.size() - 1)]
	Boosters.grant(data, id, 1)
	return {"type": "booster", "id": id}

static func _jackpot(data: Dictionary, rng: RandomNumberGenerator) -> Dictionary:
	var unowned := _unowned_skins(data)
	if unowned.is_empty():
		return _booster(data, rng)
	var id: String = unowned[rng.randi_range(0, unowned.size() - 1)]
	data["skins_owned"].append(id)
	return {"type": "jackpot", "id": id}

## Unowned skin with the most shards (closest to completion), or "" if none.
static func _nearest_incomplete_skin(data: Dictionary) -> String:
	var best := ""
	var best_shards := -1
	for id in Skins.ids():
		if data["skins_owned"].has(id):
			continue
		var s := int(data["shards"].get(id, 0))
		if s > best_shards:
			best_shards = s
			best = id
	return best

static func _unowned_skins(data: Dictionary) -> Array:
	var out: Array = []
	for id in Skins.ids():
		if not data["skins_owned"].has(id):
			out.append(id)
	return out
