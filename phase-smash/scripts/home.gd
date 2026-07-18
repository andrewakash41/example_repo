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
	UIKit.fill_gradient(self, Color(0.10, 0.06, 0.20), Color(0.03, 0.02, 0.07))
	var box := UIKit.center_box(self, 26)

	box.add_child(UIKit.label(Strings.t("app_title"), 68, Color(1, 0.54, 0.12)))

	# Equipped-skin preview swatch — doubles as a nudge toward the skin shop (D3).
	var skin := Skins.get_skin(SaveManager.data["equipped_skin"])
	var swatch := ColorRect.new()
	swatch.color = skin.base
	swatch.custom_minimum_size = Vector2(64, 64)
	var swatch_row := CenterContainer.new()
	swatch_row.add_child(swatch)
	box.add_child(swatch_row)

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

	# Levels (select/replay + Weekly) and Missions (E3/E4/E5).
	var row2 := HBoxContainer.new()
	row2.alignment = BoxContainer.ALIGNMENT_CENTER
	row2.add_theme_constant_override("separation", 18)
	box.add_child(row2)
	row2.add_child(UIKit.button("Levels", 30, _on_levels, Vector2(180, 78)))
	var claimable := Missions.claimable_count(SaveManager.data)
	var missions_label := "Missions" if claimable == 0 else "Missions (%d)" % claimable
	var missions_btn := UIKit.button(missions_label, 30, _on_missions, Vector2(180, 78))
	if claimable > 0:
		missions_btn.add_theme_color_override("font_color", Color(1, 0.85, 0.3))
	row2.add_child(missions_btn)

	# Booster count strip (D3).
	var bstrip := HBoxContainer.new()
	bstrip.alignment = BoxContainer.ALIGNMENT_CENTER
	bstrip.add_theme_constant_override("separation", 24)
	box.add_child(bstrip)
	for id in Boosters.IDS:
		bstrip.add_child(UIKit.label("%s  x%d" % [Boosters.info(id).name, Boosters.count(SaveManager.data, id)],
			22, Color(1, 1, 1, 0.7)))

	var progress := int(SaveManager.data["crate_progress"])
	if Crates.can_open(SaveManager.data):
		var crate := UIKit.button(Strings.t("home_open_crate"), 32, _on_crate, Vector2(300, 84))
		crate.add_theme_color_override("font_color", Color(1, 0.85, 0.3))
		box.add_child(crate)
	else:
		# Crate progress as a labelled bar rather than bare text (D3).
		box.add_child(UIKit.label(Strings.f("home_crate_progress", [progress, Crates.CRATE_COST]), 24, Color(1, 1, 1, 0.7)))
		var bar := ProgressBar.new()
		bar.show_percentage = false
		bar.max_value = Crates.CRATE_COST
		bar.value = progress
		bar.custom_minimum_size = Vector2(300, 18)
		var bar_row := CenterContainer.new()
		bar_row.add_child(bar)
		box.add_child(bar_row)

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

func _on_levels() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_level_select()

func _on_missions() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_missions()
