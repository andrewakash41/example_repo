extends Node
## Local persistence (§8.3). Single JSON at user://save.json, written atomically
## (temp + rename) on level clear, crate open, booster/skin change, settings
## change, and app pause. Versioned with a migration stub. A corrupt file is
## backed up to save.bak, then a fresh save starts and `recovered` is emitted so
## the UI can toast the player. All state is local — no accounts, no cloud (§1).

const SAVE_PATH := "user://save.json"
const TMP_PATH := "user://save.json.tmp"
const BAK_PATH := "user://save.bak"
const SAVE_VERSION := 1

signal recovered  ## emitted when a corrupt save was reset

var data: Dictionary = default_data()

func _ready() -> void:
	load_game()

# --- Default schema ---------------------------------------------------------

static func default_data() -> Dictionary:
	return {
		"save_version": SAVE_VERSION,
		"highest_level": 1,
		"best_scores": {},                       # {level(str): best}
		"lifetime": {"levels_cleared": 0, "segments_smashed": 0, "deaths": 0},
		"crate_progress": 0,
		"clears_since_free_shield": 0,
		"boosters": {"shield": 0, "slow_mo": 0, "head_start": 0},
		"equipped": {"shield": false, "slow_mo": false, "head_start": false},
		"shards": {},                            # {skin_id: count}
		"skins_owned": ["default"],
		"equipped_skin": "default",
		"settings": {"music": true, "sfx": true, "haptics": true, "lite_fx": false},
		"hints_seen": {"intro": false, "opposite": false},  # each tutorial hint shows once (B10)
		"daily": {"date": "", "rewarded_count": 0},  # shared rewarded cap (§9.2)
		"ads": {
			"consent_status": "",           # "", "obtained", "declined"
			"sessions_started": 0,
			"last_interstitial_time": 0.0,
			"last_interstitial_level": 0,
			"last_rewarded_time": 0.0,
		},
	}

# --- Load / save (file IO) --------------------------------------------------

func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		data = default_data()
		return
	var text := FileAccess.get_file_as_string(SAVE_PATH)
	var parsed := parse_save(text)
	if not parsed["ok"]:
		_backup_corrupt()
		data = default_data()
		save_game()
		recovered.emit()
		return
	data = merge_defaults(migrate(parsed["data"]), default_data())

func save_game() -> void:
	var json := JSON.stringify(data)
	var f := FileAccess.open(TMP_PATH, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(json)
	f.close()
	# Atomic-ish replace: rename temp over the target.
	var dir := DirAccess.open("user://")
	if dir == null:
		return
	if dir.file_exists("save.json"):
		dir.remove("save.json")
	dir.rename("save.json.tmp", "save.json")

func _backup_corrupt() -> void:
	var dir := DirAccess.open("user://")
	if dir and dir.file_exists("save.json"):
		if dir.file_exists("save.bak"):
			dir.remove("save.bak")
		dir.copy(SAVE_PATH, BAK_PATH)

# --- Pure helpers (unit-tested, no file IO) ---------------------------------

## Parses save text. Returns {ok: bool, data: Dictionary}.
static func parse_save(text: String) -> Dictionary:
	var json := JSON.new()
	if json.parse(text) != OK:
		return {"ok": false, "data": {}}
	var d = json.data
	if typeof(d) != TYPE_DICTIONARY or not d.has("save_version"):
		return {"ok": false, "data": {}}
	return {"ok": true, "data": d}

## Migration stub — bumps old saves forward. New cases append here.
static func migrate(d: Dictionary) -> Dictionary:
	var v := int(d.get("save_version", 0))
	# if v < 1: ...transform...
	d["save_version"] = SAVE_VERSION
	return d

## Recursively fills any keys missing from `d` using `defaults` (forward-compat
## when the schema grows). Does not overwrite existing values.
static func merge_defaults(d: Dictionary, defaults: Dictionary) -> Dictionary:
	for k in defaults:
		if not d.has(k):
			d[k] = defaults[k]
		elif typeof(d[k]) == TYPE_DICTIONARY and typeof(defaults[k]) == TYPE_DICTIONARY:
			d[k] = merge_defaults(d[k], defaults[k])
	return d

# --- Convenience API --------------------------------------------------------

func get_best_score(level_number: int) -> int:
	return int(data["best_scores"].get(str(level_number), 0))

func record_best_score(level_number: int, score: int) -> void:
	if score > get_best_score(level_number):
		data["best_scores"][str(level_number)] = score

func flush() -> void:
	save_game()
