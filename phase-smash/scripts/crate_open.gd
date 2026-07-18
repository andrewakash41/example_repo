extends Control
## Crate open screen (§7.2): a short reveal, then the reward. Opening animation
## is skippable after the first view (tap to skip). Draws via Crates.open and
## persists the result.

var _router: Node
var _revealed := false
var _reward: Dictionary

func set_router(router: Node) -> void:
	_router = router

func on_back_requested() -> void:
	if _revealed:
		_router.go_to_home()
	else:
		_reveal()

func _ready() -> void:
	UIKit.fill_bg(self, Color(0.05, 0.03, 0.10))
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	_reward = Crates.open(SaveManager.data, rng)
	SaveManager.save_game()
	AudioManager.play_sfx(&"crate_open")

	var box := UIKit.center_box(self, 26)
	box.name = "Box"
	box.add_child(UIKit.label("CRATE", 40, Color(1, 1, 1, 0.6)))
	var chest := UIKit.label("🎁", 120)
	box.add_child(chest)

	# Simple 1.5s open animation, then reveal (§7.2). Tap anywhere to skip.
	var tw := create_tween()
	tw.tween_property(chest, "scale", Vector2(1.2, 1.2), 0.75).set_trans(Tween.TRANS_SINE)
	tw.tween_property(chest, "scale", Vector2(1.0, 1.0), 0.35)
	tw.tween_callback(_reveal)

func _unhandled_input(event: InputEvent) -> void:
	if (event is InputEventScreenTouch or event is InputEventMouseButton) and event.pressed:
		if not _revealed:
			_reveal()

func _reveal() -> void:
	if _revealed:
		return
	_revealed = true
	for c in get_children():
		c.queue_free()
	UIKit.fill_bg(self, Color(0.05, 0.03, 0.10))
	var box := UIKit.center_box(self, 24)
	box.add_child(UIKit.label("YOU GOT", 34, Color(1, 1, 1, 0.6)))
	box.add_child(UIKit.label(_reward_text(), 44, Color(1, 0.85, 0.3)))
	# A boss +5 (or a 2x-crate) can bank enough progress for several crates; let
	# the player open them all here instead of round-tripping through Home (B15).
	if Crates.can_open(SaveManager.data):
		box.add_child(UIKit.button("Open another", 32, _on_open_another, Vector2(280, 84)))
	box.add_child(UIKit.button("Nice!", 34, _on_done, Vector2(240, 84)))

func _on_open_another() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_crate()  # reloads the crate screen, drawing the next reward

func _reward_text() -> String:
	match _reward["type"]:
		"skin", "jackpot":
			return "%s skin!" % Skins.get_skin(_reward["id"]).name
		"shard":
			return "%s shard (%d/5)" % [Skins.get_skin(_reward["id"]).name, _reward["count"]]
		"booster":
			return "%s booster" % Boosters.info(_reward["id"]).name
	return "Reward"

func _on_done() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_home()
