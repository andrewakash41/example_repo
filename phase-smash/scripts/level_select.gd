extends Control
## Level select + replay (E3, §R5). A scrolling list of cleared levels with best
## scores; replaying an already-cleared level is allowed (crate progress at half
## rate is enforced in game via GameState.replay_mode). Also hosts the Weekly
## Challenge entry (E5). Keeps the campaign's "furthest reached" untouched.

var _router: Node

func set_router(router: Node) -> void:
	_router = router

func on_back_requested() -> void:
	_router.go_to_home()

func _ready() -> void:
	UIKit.fill_gradient(self, Color(0.10, 0.06, 0.20), Color(0.03, 0.02, 0.07))
	var root := VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.offset_top = 70
	root.offset_left = 40
	root.offset_right = -40
	root.offset_bottom = -30
	root.add_theme_constant_override("separation", 16)
	add_child(root)

	root.add_child(UIKit.label("LEVELS", 52, Color(0.9, 0.9, 1)))

	# Weekly Challenge entry (E5).
	var key := WeeklyChallenge.week_key(Time.get_unix_time_from_system())
	var wbest := WeeklyChallenge.best_for(SaveManager.data, key)
	var weekly_btn := UIKit.button("★ Weekly Challenge  (best %d)" % wbest, 26, _on_weekly, Vector2(420, 76))
	weekly_btn.add_theme_color_override("font_color", Color(1, 0.85, 0.3))
	root.add_child(weekly_btn)

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 8)
	scroll.add_child(list)

	# One row per already-reached level (1 .. highest_level).
	var highest := int(SaveManager.data["highest_level"])
	for n in range(1, highest + 1):
		var best := SaveManager.get_best_score(n)
		var boss := n % 10 == 0
		var label := "Level %d%s   —   best %d" % [n, "  (BOSS)" if boss else "", best]
		list.add_child(UIKit.button(label, 24, _on_play_level.bind(n), Vector2(440, 64)))

	root.add_child(UIKit.button(Strings.t("btn_back"), 26, _on_back, Vector2(180, 66)))

func _on_play_level(n: int) -> void:
	AudioManager.play_sfx(&"ui_tap")
	GameState.weekly_mode = false
	# Replaying a level the player is already past earns crate progress at half
	# rate (E3); the current frontier plays normally.
	GameState.replay_mode = n < int(SaveManager.data["highest_level"])
	GameState.current_level = n
	_router.go_to_game()

func _on_weekly() -> void:
	AudioManager.play_sfx(&"ui_tap")
	var key := WeeklyChallenge.week_key(Time.get_unix_time_from_system())
	GameState.weekly_mode = true
	GameState.replay_mode = false
	GameState.weekly_level = WeeklyChallenge.level_for_week(key)
	_router.go_to_game()

func _on_back() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_home()
