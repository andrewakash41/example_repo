extends Control
## Skins gallery (§7.3): a scrollable grid of the 12 skins. Owned ones equip in
## place (no scene reload); locked ones open a preview popup with shard progress
## instead of being dead disabled buttons (B16).

var _router: Node
var _grid: GridContainer
var _tiles: Dictionary = {}  # skin_id -> Button
var _popup: Control

func set_router(router: Node) -> void:
	_router = router

func on_back_requested() -> void:
	if _popup and is_instance_valid(_popup):
		_close_preview()
	else:
		_router.go_to_home()

func _ready() -> void:
	UIKit.fill_gradient(self, Color(0.10, 0.06, 0.20), Color(0.03, 0.02, 0.07))
	var root := VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.offset_top = 80
	root.offset_left = 40
	root.offset_right = -40
	root.offset_bottom = -40
	root.add_theme_constant_override("separation", 20)
	add_child(root)

	root.add_child(UIKit.label("SKINS", 52, Color(0.9, 0.7, 1)))

	# ScrollContainer so 12 tiles never overflow short screens (B16).
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(scroll)

	_grid = GridContainer.new()
	_grid.columns = 3
	_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_grid.add_theme_constant_override("h_separation", 14)
	_grid.add_theme_constant_override("v_separation", 14)
	scroll.add_child(_grid)

	for skin in Skins.all():
		var tile := _make_tile(skin)
		_tiles[skin.id] = tile
		_grid.add_child(tile)

	root.add_child(UIKit.button("Back", 28, _on_back, Vector2(180, 72)))

func _make_tile(skin) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(200, 150)
	b.add_theme_font_size_override("font_size", 22)
	_style_tile(b, skin)
	return b

## (Re)applies a tile's label, color, and press handler from current save state,
## so equipping can refresh in place without rebuilding the scene (B16).
func _style_tile(b: Button, skin) -> void:
	var owned: bool = SaveManager.data["skins_owned"].has(skin.id)
	var equipped: bool = SaveManager.data["equipped_skin"] == skin.id
	for c in b.pressed.get_connections():
		b.pressed.disconnect(c["callable"])
	if owned:
		b.text = "%s%s" % [skin.name, "\n[ON]" if equipped else ""]
		b.add_theme_color_override("font_color", skin.base)
		b.disabled = false
		b.pressed.connect(_on_equip.bind(skin.id))
	else:
		var shards := int(SaveManager.data["shards"].get(skin.id, 0))
		b.text = "%s\n🔒 %d/5" % [skin.name, shards]
		b.add_theme_color_override("font_color", Color(1, 1, 1, 0.55))
		b.disabled = false  # not dead: tapping opens a preview (B16)
		b.pressed.connect(_on_preview.bind(skin.id))

func _refresh_tiles() -> void:
	for skin in Skins.all():
		var b = _tiles.get(skin.id)
		if b and is_instance_valid(b):
			_style_tile(b, skin)

func _on_equip(id: String) -> void:
	AudioManager.play_sfx(&"ui_tap")
	SaveManager.data["equipped_skin"] = id
	SaveManager.save_game()
	_refresh_tiles()  # in place, no reload (B16)

# --- Locked-skin preview popup ---------------------------------------------

func _on_preview(id: String) -> void:
	AudioManager.play_sfx(&"ui_tap")
	var skin := Skins.get_skin(id)
	var shards := int(SaveManager.data["shards"].get(id, 0))
	_close_preview()
	_popup = Control.new()
	_popup.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_popup)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.7)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(_on_dim_input)
	_popup.add_child(dim)
	var box := UIKit.center_box(_popup, 20)
	box.add_child(UIKit.label(skin.name, 44, skin.base))
	var swatch := ColorRect.new()
	swatch.color = skin.base
	swatch.custom_minimum_size = Vector2(120, 120)
	var swatch_center := CenterContainer.new()
	swatch_center.add_child(swatch)
	box.add_child(swatch_center)
	box.add_child(UIKit.label("🔒 %d / 5 shards" % shards, 30, Color(1, 1, 1, 0.8)))
	box.add_child(UIKit.label("Unlock with crate shards", 22, Color(1, 1, 1, 0.5)))
	box.add_child(UIKit.button("Close", 28, _close_preview, Vector2(200, 72)))

func _on_dim_input(event: InputEvent) -> void:
	if (event is InputEventScreenTouch or event is InputEventMouseButton) and event.pressed:
		_close_preview()

func _close_preview() -> void:
	if _popup and is_instance_valid(_popup):
		_popup.queue_free()
	_popup = null

func _on_back() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_home()
