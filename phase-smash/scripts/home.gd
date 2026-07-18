extends Control
## P0 home screen: title + PLAY. The real home (skin button, crate widget,
## booster strip) is built in P4 (§10). Kept deliberately bare for now.

var _router: Node

func set_router(router: Node) -> void:
	_router = router

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.06, 0.04, 0.12)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 32)
	add_child(box)

	var title := Label.new()
	title.text = "PHASE SMASH"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 72)
	title.add_theme_color_override("font_color", Color(1, 0.54, 0.12))
	box.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "P0 greybox — hold to smash"
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 28)
	subtitle.add_theme_color_override("font_color", Color(0.12, 0.78, 1))
	box.add_child(subtitle)

	var play := Button.new()
	play.text = "PLAY"
	play.custom_minimum_size = Vector2(320, 120)
	play.add_theme_font_size_override("font_size", 48)
	play.pivot_offset = Vector2(160, 60)
	play.pressed.connect(_on_play_pressed)
	box.add_child(play)

	# Gentle idle pulse on PLAY (UI tween juice, §6.3).
	var tw := create_tween().set_loops()
	tw.tween_property(play, "scale", Vector2(1.05, 1.05), 0.7).set_trans(Tween.TRANS_SINE)
	tw.tween_property(play, "scale", Vector2(1.0, 1.0), 0.7).set_trans(Tween.TRANS_SINE)

	AudioManager.play_music(&"menu")

func _on_play_pressed() -> void:
	AudioManager.play_sfx(&"ui_tap")
	if _router and _router.has_method("go_to_game"):
		_router.go_to_game()
