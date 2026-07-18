extends Control
## Skins gallery (§7.3): a grid of the 12 skins. Owned ones can be equipped;
## locked ones show shard progress toward unlock.

var _router: Node

func set_router(router: Node) -> void:
	_router = router

func _ready() -> void:
	UIKit.fill_bg(self, Color(0.06, 0.04, 0.12))
	var root := VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.offset_top = 80
	root.offset_left = 40
	root.offset_right = -40
	root.offset_bottom = -40
	root.add_theme_constant_override("separation", 20)
	add_child(root)

	root.add_child(UIKit.label("SKINS", 52, Color(0.9, 0.7, 1)))

	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	root.add_child(grid)

	for skin in Skins.all():
		grid.add_child(_make_tile(skin))

	root.add_child(UIKit.button("Back", 28, _on_back, Vector2(180, 72)))

func _make_tile(skin) -> Button:
	var owned: bool = SaveManager.data["skins_owned"].has(skin.id)
	var equipped: bool = SaveManager.data["equipped_skin"] == skin.id
	var b := Button.new()
	b.custom_minimum_size = Vector2(200, 150)
	b.add_theme_font_size_override("font_size", 22)
	if owned:
		b.text = "%s%s" % [skin.name, "\n[ON]" if equipped else ""]
		b.add_theme_color_override("font_color", skin.base)
		b.pressed.connect(_on_equip.bind(skin.id))
	else:
		var shards := int(SaveManager.data["shards"].get(skin.id, 0))
		b.text = "%s\n🔒 %d/5" % [skin.name, shards]
		b.add_theme_color_override("font_color", Color(1, 1, 1, 0.45))
		b.disabled = true
	return b

func _on_equip(id: String) -> void:
	AudioManager.play_sfx(&"ui_tap")
	SaveManager.data["equipped_skin"] = id
	SaveManager.save_game()
	_router.go_to_skins()  # rebuild to reflect the new [ON]

func _on_back() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_home()
