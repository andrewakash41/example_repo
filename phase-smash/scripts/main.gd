extends Node
## Thin root that swaps whole screens (§8.2). Overlays inside Game are its own
## CanvasLayers so a run is never reloaded mid-play. Screens get a back-reference
## via set_router() and call the go_to_* methods below.

const SCENES := {
	"home": "res://scenes/home.tscn",
	"prelevel": "res://scenes/prelevel.tscn",
	"game": "res://scenes/game.tscn",
	"skins": "res://scenes/skins.tscn",
	"settings": "res://scenes/settings.tscn",
	"crate": "res://scenes/crate.tscn",
}

var _current: Node

func _ready() -> void:
	# UMP consent on first launch, before any ad can serve (§9.1).
	AdManager.request_consent()
	# First launch drops the player straight into Level 1 after consent (§10.9);
	# every later session opens on Home. sessions_started is bumped to 1 by
	# AdManager on the first run (B5).
	if int(SaveManager.data["ads"].get("sessions_started", 0)) <= 1:
		go_to_game()
	else:
		go_to_home()

func go_to_home() -> void: _swap("home")
func go_to_prelevel() -> void: _swap("prelevel")
func go_to_game() -> void: _swap("game")
func go_to_skins() -> void: _swap("skins")
func go_to_settings() -> void: _swap("settings")
func go_to_crate() -> void: _swap("crate")

## Android back gesture / window back request (§8.5): hand it to the active
## screen, which decides (game pauses, menus go back, home double-taps to exit).
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if _current and is_instance_valid(_current) and _current.has_method("on_back_requested"):
			_current.on_back_requested()

func _swap(key: String) -> void:
	# Defensive reset (B8): any screen can be left mid hit-stop / slow-mo / pause
	# (e.g. a timer frees the game scene at 0.4x). Clear global time state here so
	# a stray leak can never freeze or slow the whole app across a screen swap.
	Engine.time_scale = 1.0
	get_tree().paused = false
	if _current and is_instance_valid(_current):
		_current.queue_free()
	var scene: PackedScene = load(SCENES[key])
	_current = scene.instantiate()
	add_child(_current)
	if _current.has_method("set_router"):
		_current.set_router(self)
