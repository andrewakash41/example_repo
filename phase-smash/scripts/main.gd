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
	go_to_home()

func go_to_home() -> void: _swap("home")
func go_to_prelevel() -> void: _swap("prelevel")
func go_to_game() -> void: _swap("game")
func go_to_skins() -> void: _swap("skins")
func go_to_settings() -> void: _swap("settings")
func go_to_crate() -> void: _swap("crate")

func _swap(key: String) -> void:
	if _current and is_instance_valid(_current):
		_current.queue_free()
	var scene: PackedScene = load(SCENES[key])
	_current = scene.instantiate()
	add_child(_current)
	if _current.has_method("set_router"):
		_current.set_router(self)
