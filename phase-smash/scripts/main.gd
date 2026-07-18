extends Node
## Thin root that swaps Home <-> Game (§8.2). Never reloads mid-run; overlays
## inside Game are CanvasLayers so the revive flow can resume in place later.

const HOME_SCENE := preload("res://scenes/home.tscn")
const GAME_SCENE := preload("res://scenes/game.tscn")

var _current: Node

func _ready() -> void:
	go_to_home()

func go_to_home() -> void:
	_swap(HOME_SCENE)

func go_to_game() -> void:
	_swap(GAME_SCENE)

func _swap(scene: PackedScene) -> void:
	if _current and is_instance_valid(_current):
		_current.queue_free()
	_current = scene.instantiate()
	add_child(_current)
	# Give scenes a back-reference to the router without a hard dependency.
	if _current.has_method("set_router"):
		_current.set_router(self)
