extends Control
## Pre-level screen (§10, §7.1): level + theme preview, three booster slots that
## equip/unequip on tap (showing owned counts), and PLAY -> Game.

var _router: Node
var _slots: Dictionary = {}   # id -> Button
var _refills: Dictionary = {} # id -> Button (the "+2 (Ad)" refill)

func set_router(router: Node) -> void:
	_router = router

func on_back_requested() -> void:
	_router.go_to_home()

func _ready() -> void:
	var level := LevelLibrary.get_level(SaveManager.data["highest_level"])
	var theme := Themes.get_theme(level.theme_id)
	UIKit.fill_bg(self, theme.sky_top)
	var box := UIKit.center_box(self, 22)

	box.add_child(UIKit.label("LEVEL %d" % level.level_number, 60, Color(1, 0.9, 0.7)))
	var sub := "%s%s" % [theme.name, "  •  BOSS" if level.is_boss else ""]
	box.add_child(UIKit.label(sub, 28, Color(1, 1, 1, 0.7)))
	box.add_child(UIKit.label("Boosters (tap to equip)", 24, Color(1, 1, 1, 0.6)))

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	box.add_child(row)
	for id in Boosters.IDS:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 6)
		row.add_child(col)
		var b := UIKit.button("", 24, _on_slot.bind(id), Vector2(200, 120))
		_slots[id] = b
		col.add_child(b)
		# "+2 via rewarded ad" refill (§7.1, §9.2 placement 4). Hidden while no
		# rewarded ad can play so we never show a dead button (§3.6, B14).
		var refill := UIKit.button("+2 (Ad)", 20, _on_refill.bind(id), Vector2(200, 48))
		_refills[id] = refill
		col.add_child(refill)
		_refresh_slot(id)

	box.add_child(UIKit.button("PLAY", 46, _on_play, Vector2(320, 110)))
	box.add_child(UIKit.button("Back", 26, _on_back, Vector2(180, 70)))
	_refresh_refills()
	AdManager.ad_availability_changed.connect(_refresh_refills)

func _refresh_refills() -> void:
	var ready := AdManager.is_rewarded_ready()
	for id in _refills:
		var b: Button = _refills[id]
		if is_instance_valid(b):
			b.visible = ready

func _refresh_slot(id: String) -> void:
	var info := Boosters.info(id)
	var n := Boosters.count(SaveManager.data, id)
	var equipped := Boosters.is_equipped(SaveManager.data, id)
	var b: Button = _slots[id]
	b.text = "%s\nx%d%s" % [info.name, n, "\n[EQUIPPED]" if equipped else ""]
	b.disabled = n <= 0 and not equipped
	b.add_theme_color_override("font_color", Color(0.3, 1, 0.6) if equipped else Color(0.9, 0.9, 0.95))

func _on_slot(id: String) -> void:
	AudioManager.play_sfx(&"ui_tap")
	Boosters.toggle_equip(SaveManager.data, id)
	SaveManager.save_game()
	_refresh_slot(id)

func _on_refill(id: String) -> void:
	AudioManager.play_sfx(&"ui_tap")
	AdManager.show_rewarded(
		AdConfig.Placement.BOOSTER_REFILL,
		_grant_refill.bind(id))

func _grant_refill(id: String) -> void:
	Boosters.grant(SaveManager.data, id, 2)
	SaveManager.save_game()
	_refresh_slot(id)

func _on_play() -> void:
	AudioManager.play_sfx(&"ui_tap")
	GameState.weekly_mode = false   # frontier run: campaign mode (E3/E5)
	GameState.replay_mode = false
	GameState.current_level = int(SaveManager.data["highest_level"])
	_router.go_to_game()

func _on_back() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_home()
