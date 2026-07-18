extends Control
## Missions screen (E4, §R5). Lists the data-driven missions with progress bars
## and a Claim button on completed-but-unclaimed ones. Rebuilds in place after a
## claim so the crate reward and claimed state show immediately.

var _router: Node
var _list: VBoxContainer

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

	root.add_child(UIKit.label("MISSIONS", 52, Color(0.9, 0.9, 1)))

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 10)
	scroll.add_child(_list)
	_rebuild_list()

	root.add_child(UIKit.button(Strings.t("btn_back"), 26, _on_back, Vector2(180, 66)))

func _rebuild_list() -> void:
	for c in _list.get_children():
		c.queue_free()
	for m in Missions.LIST:
		_list.add_child(_make_row(m))

func _make_row(m: Dictionary) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var prog := Missions.progress(SaveManager.data, m)
	col.add_child(UIKit.label("%s   (+%d crate)" % [m["name"], m["reward"]], 22, Color(1, 1, 1, 0.9)))
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.max_value = int(m["target"])
	bar.value = prog
	bar.custom_minimum_size = Vector2(0, 16)
	col.add_child(bar)
	col.add_child(UIKit.label("%d / %d" % [prog, int(m["target"])], 18, Color(1, 1, 1, 0.55)))
	row.add_child(col)

	if Missions.is_claimed(SaveManager.data, m["id"]):
		row.add_child(UIKit.label("✓", 30, Color(0.4, 1, 0.6)))
	elif Missions.is_complete(SaveManager.data, m):
		row.add_child(UIKit.button("Claim", 22, _on_claim.bind(m), Vector2(140, 60)))
	return row

func _on_claim(m: Dictionary) -> void:
	AudioManager.play_sfx(&"crate_open")
	if Missions.claim(SaveManager.data, m):
		SaveManager.save_game()
	_rebuild_list()

func _on_back() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_home()
