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
	"level_select": "res://scenes/level_select.tscn",
	"missions": "res://scenes/missions.tscn",
}

var _current: Node
var _theme: Theme
var _fader: ColorRect          # full-screen fade layer for screen transitions (D2)

func _ready() -> void:
	_theme = UITheme.get_theme()
	_build_fader()
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
func go_to_level_select() -> void: _swap("level_select")
func go_to_missions() -> void: _swap("missions")

## Android back gesture / window back request (§8.5): hand it to the active
## screen, which decides (game pauses, menus go back, home double-taps to exit).
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if _current and is_instance_valid(_current) and _current.has_method("on_back_requested"):
			_current.on_back_requested()

## Full-screen fader on its own CanvasLayer, above screens (D2). Starts clear.
func _build_fader() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 100
	add_child(layer)
	_fader = ColorRect.new()
	_fader.color = Color(0.04, 0.03, 0.08, 0.0)
	_fader.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fader.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_fader)

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
	if _current is Control:
		(_current as Control).theme = _theme  # one theme for the whole screen (C4/D1)
	add_child(_current)
	if _current.has_method("set_router"):
		_current.set_router(self)
	_fade_in()

## Quick fade from the cover color to clear after a screen is built (D2). Kept
## short (0.18s) so navigation stays snappy. Runs unscaled so pause can't stall it.
func _fade_in() -> void:
	if not _fader:
		return
	_fader.color.a = 1.0
	var tw := create_tween().set_ignore_time_scale(true)
	tw.tween_property(_fader, "color:a", 0.0, 0.18)
