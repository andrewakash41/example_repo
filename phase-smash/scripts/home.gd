extends Control
## Home screen (§10): PLAY (-> pre-level), level number, skins, settings, and a
## crate widget that opens when progress is full. Built in code.

var _router: Node

func set_router(router: Node) -> void:
	_router = router

func _ready() -> void:
	UIKit.fill_bg(self, Color(0.06, 0.04, 0.12))
	var box := UIKit.center_box(self, 26)

	box.add_child(UIKit.label("PHASE SMASH", 68, Color(1, 0.54, 0.12)))
	box.add_child(UIKit.label("Level %d" % SaveManager.data["highest_level"], 30, Color(0.12, 0.78, 1)))

	var play := UIKit.button("PLAY", 48, _on_play, Vector2(320, 118))
	play.pivot_offset = Vector2(160, 59)
	box.add_child(play)
	var tw := create_tween().set_loops()
	tw.tween_property(play, "scale", Vector2(1.05, 1.05), 0.7).set_trans(Tween.TRANS_SINE)
	tw.tween_property(play, "scale", Vector2(1.0, 1.0), 0.7).set_trans(Tween.TRANS_SINE)

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 18)
	box.add_child(row)
	row.add_child(UIKit.button("Skins", 30, _on_skins, Vector2(180, 78)))
	row.add_child(UIKit.button("Settings", 30, _on_settings, Vector2(180, 78)))

	var progress := int(SaveManager.data["crate_progress"])
	if Crates.can_open(SaveManager.data):
		var crate := UIKit.button("OPEN CRATE!", 32, _on_crate, Vector2(300, 84))
		crate.add_theme_color_override("font_color", Color(1, 0.85, 0.3))
		box.add_child(crate)
	else:
		box.add_child(UIKit.label("Crate  %d / %d" % [progress, Crates.CRATE_COST], 26, Color(1, 1, 1, 0.7)))

	AudioManager.play_music(&"menu")

func _on_play() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_prelevel()

func _on_skins() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_skins()

func _on_settings() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_settings()

func _on_crate() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_crate()
