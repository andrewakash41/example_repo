extends Control
## Home screen (§10): PLAY (-> pre-level), level number, skins, settings, and a
## crate widget that opens when progress is full. Built in code.

var _router: Node
var _last_back_ms := -10000

func set_router(router: Node) -> void:
	_router = router

## Double-back-to-exit on home (§8.5).
func on_back_requested() -> void:
	var now := Time.get_ticks_msec()
	if now - _last_back_ms < 1500:
		get_tree().quit()
	else:
		_last_back_ms = now
		_toast(Strings.t("home_exit_toast"))

func _toast(text: String) -> void:
	var l := UIKit.label(text, 26, Color(1, 1, 1, 0.85))
	l.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	# Give the label real width so the centered text is actually centered on
	# screen rather than growing rightward from the anchor point (B18).
	l.offset_left = -320
	l.offset_right = 320
	l.offset_top = -160
	add_child(l)
	var tw := create_tween()
	tw.tween_interval(1.2)
	tw.tween_property(l, "modulate:a", 0.0, 0.4)
	tw.tween_callback(l.queue_free)

func _ready() -> void:
	UIKit.fill_bg(self, Color(0.06, 0.04, 0.12))
	var box := UIKit.center_box(self, 26)

	box.add_child(UIKit.label(Strings.t("app_title"), 68, Color(1, 0.54, 0.12)))
	box.add_child(UIKit.label(Strings.f("home_level", [SaveManager.data["highest_level"]]), 30, Color(0.12, 0.78, 1)))

	var play := UIKit.button(Strings.t("btn_play"), 48, _on_play, Vector2(320, 118))
	play.pivot_offset = Vector2(160, 59)
	box.add_child(play)
	var tw := create_tween().set_loops()
	tw.tween_property(play, "scale", Vector2(1.05, 1.05), 0.7).set_trans(Tween.TRANS_SINE)
	tw.tween_property(play, "scale", Vector2(1.0, 1.0), 0.7).set_trans(Tween.TRANS_SINE)

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 18)
	box.add_child(row)
	row.add_child(UIKit.button(Strings.t("btn_skins"), 30, _on_skins, Vector2(180, 78)))
	row.add_child(UIKit.button(Strings.t("btn_settings"), 30, _on_settings, Vector2(180, 78)))

	var progress := int(SaveManager.data["crate_progress"])
	if Crates.can_open(SaveManager.data):
		var crate := UIKit.button(Strings.t("home_open_crate"), 32, _on_crate, Vector2(300, 84))
		crate.add_theme_color_override("font_color", Color(1, 0.85, 0.3))
		box.add_child(crate)
	else:
		box.add_child(UIKit.label(Strings.f("home_crate_progress", [progress, Crates.CRATE_COST]), 26, Color(1, 1, 1, 0.7)))

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
