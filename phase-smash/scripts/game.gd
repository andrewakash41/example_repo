extends Node3D
## P0 greybox gameplay. A rotating segmented tower, a single scripted ball with
## hold-to-smash / release-to-idle-bounce, camera follow, and segment shatter.
## No phases, no obsidian, no fever yet — those are P1 (§3). Ball motion and
## collision are fully scripted (no physics bodies) per §8.4.

const TowerGen := preload("res://scripts/tower_generator.gd")
const ShatterScript := preload("res://scripts/shatter.gd")
const HudScript := preload("res://scripts/hud.gd")

# --- Tuning (P0 greybox subset of §4; all provisional, refined in P1) -------
const SEGMENT_COUNT := 8
const PLATFORM_GAP := 0.9          # vertical gap between platforms (§4)
const PLATFORM_THICKNESS := 0.25   # §3.3
const RING_INNER := 0.5
const RING_OUTER := 2.4            # disc radius (§3.3)
const RING_MID := (RING_INNER + RING_OUTER) * 0.5
const BALL_RADIUS := 0.35

const SMASH_ACCEL := 150.0         # reaches terminal in ~0.15s (§4)
const SMASH_TERMINAL := 22.0       # m/s (§4)
const GRAVITY_IDLE := 40.0         # idle-bounce gravity (greybox feel)
const IDLE_BOUNCE_HEIGHT := 1.0    # ~1.2 gaps (§4), trimmed for greybox
const START_DROP_GAPS := 3.0       # ball spawn height above platform 0

var _router: Node
var _hud: Hud
var _tower: Node3D
var _ball: MeshInstance3D
var _camera: Camera3D

# Tower data
var _platforms: Array = []         # Array[Array[int]] segment states
var _broken: Array = []            # Array[Array[bool]]
var _seg_nodes: Array = []         # Array[Array[MeshInstance3D]]
var _platform_count: int = 30
var _rot_speed := deg_to_rad(30.0)
var _tower_rot := 0.0

# Ball state
var _ball_y := 0.0
var _ball_vy := 0.0
var _holding := false
var _finished := false

var _seg_angle := TAU / SEGMENT_COUNT
var _cam_look_y := 0.0
var _idle_bounce_v := 0.0

func set_router(router: Node) -> void:
	_router = router

func _ready() -> void:
	_idle_bounce_v = sqrt(2.0 * GRAVITY_IDLE * IDLE_BOUNCE_HEIGHT)

	var cfg := LevelLoader.load_level(GameState.current_level)
	_platform_count = cfg.platform_count
	_rot_speed = deg_to_rad(cfg.rotation_speed_deg)
	_platforms = TowerGen.generate(cfg.platform_count, cfg.segment_count, cfg.gap_pct, cfg.seed_value)

	_setup_environment()
	_build_tower()
	_build_ball()
	_build_camera()
	_build_hud()

	_ball_y = _platform_y(0) + START_DROP_GAPS * PLATFORM_GAP
	_ball_vy = 0.0
	_cam_look_y = _ball_y

	GameState.start_level(cfg.level_number)

# --- Construction -----------------------------------------------------------

func _setup_environment() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.05, 0.03, 0.10)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.5, 0.5, 0.6)
	e.ambient_light_energy = 0.8
	env.environment = e
	add_child(env)

	var light := DirectionalLight3D.new()
	light.rotation = Vector3(deg_to_rad(-55), deg_to_rad(-30), 0)
	light.light_energy = 1.1
	add_child(light)

func _build_tower() -> void:
	_tower = Node3D.new()
	_tower.name = "Tower"
	add_child(_tower)

	var solid_mat := StandardMaterial3D.new()
	solid_mat.albedo_color = Color(0.55, 0.58, 0.68)

	_broken.clear()
	_seg_nodes.clear()
	for i in _platform_count:
		var broken_row: Array[bool] = []
		var node_row: Array = []
		var py := _platform_y(i)
		for s in SEGMENT_COUNT:
			broken_row.append(false)
			if _platforms[i][s] == TowerGen.Seg.SOLID:
				var seg := _make_segment_mesh(solid_mat)
				var center_angle := (s + 0.5) * _seg_angle
				seg.position = Vector3(
					cos(center_angle) * RING_MID,
					py,
					sin(center_angle) * RING_MID)
				seg.rotation.y = -center_angle
				_tower.add_child(seg)
				node_row.append(seg)
			else:
				node_row.append(null)
		_broken.append(broken_row)
		_seg_nodes.append(node_row)

	# Finish pad at the base.
	var pad := MeshInstance3D.new()
	var pad_mesh := CylinderMesh.new()
	pad_mesh.top_radius = RING_OUTER
	pad_mesh.bottom_radius = RING_OUTER
	pad_mesh.height = 0.3
	pad.mesh = pad_mesh
	var pad_mat := StandardMaterial3D.new()
	pad_mat.albedo_color = Color(0.2, 0.9, 0.5)
	pad_mat.emission_enabled = true
	pad_mat.emission = Color(0.1, 0.7, 0.35)
	pad.material_override = pad_mat
	pad.position = Vector3(0, _finish_y(), 0)
	add_child(pad)  # not a child of Tower — the pad doesn't rotate

func _make_segment_mesh(mat: StandardMaterial3D) -> MeshInstance3D:
	var seg := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	var tangential := 2.0 * RING_MID * tan(_seg_angle * 0.5) * 0.92
	var radial := (RING_OUTER - RING_INNER)
	mesh.size = Vector3(radial, PLATFORM_THICKNESS, tangential)
	seg.mesh = mesh
	seg.material_override = mat
	return seg

func _build_ball() -> void:
	_ball = MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = BALL_RADIUS
	mesh.height = BALL_RADIUS * 2.0
	_ball.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.95, 0.9)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.6, 0.2)
	mat.emission_energy_multiplier = 0.6
	_ball.material_override = mat
	_ball.position = Vector3(RING_MID, 0, 0)  # fixed on the tower's forward edge
	add_child(_ball)

func _build_camera() -> void:
	_camera = Camera3D.new()
	_camera.fov = 60.0
	add_child(_camera)
	_camera.current = true

func _build_hud() -> void:
	_hud = HudScript.new()
	add_child(_hud)
	_hud.home_pressed.connect(_on_home)
	_hud.replay_pressed.connect(_on_replay)

# --- Per-frame --------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if _finished:
		return
	if event is InputEventScreenTouch:
		_holding = event.pressed
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_holding = event.pressed
	if _holding and _hud:
		_hud.hide_hint()

func _physics_process(delta: float) -> void:
	if _finished:
		return

	_tower_rot += _rot_speed * delta
	_tower.rotation.y = _tower_rot

	var seg_index := _segment_under_ball()

	var prev_bottom := _ball_y - BALL_RADIUS
	if _holding:
		_ball_vy = maxf(_ball_vy - SMASH_ACCEL * delta, -SMASH_TERMINAL)
	else:
		_ball_vy -= GRAVITY_IDLE * delta
	_ball_y += _ball_vy * delta
	var new_bottom := _ball_y - BALL_RADIUS

	if _ball_vy < 0.0:
		_resolve_descent(prev_bottom, new_bottom, seg_index)

	if _ball_y - BALL_RADIUS <= _finish_y() + 0.3:
		_on_level_clear()
		return

	_ball.position.y = _ball_y
	_update_camera(delta)
	_update_hud()

## Sweeps platforms crossed this tick; shatters while smashing, lands on the
## first solid surface while idle.
func _resolve_descent(prev_bottom: float, new_bottom: float, seg_index: int) -> void:
	for i in _platform_count:
		var y_top := _platform_y(i) + PLATFORM_THICKNESS * 0.5
		var crossed := prev_bottom > y_top and new_bottom <= y_top
		if not crossed:
			continue
		var solid: bool = _platforms[i][seg_index] == TowerGen.Seg.SOLID and not _broken[i][seg_index]
		if not solid:
			continue
		if _holding:
			_shatter(i, seg_index)
			# keep descending through the shattered segment
		else:
			# land and idle-bounce
			_ball_y = y_top + BALL_RADIUS
			_ball_vy = _idle_bounce_v
			return

func _shatter(platform_index: int, seg_index: int) -> void:
	_broken[platform_index][seg_index] = true
	var node: MeshInstance3D = _seg_nodes[platform_index][seg_index]
	if node and is_instance_valid(node):
		ShatterScript.burst(self, node.global_position, Color(0.7, 0.75, 0.85))
		node.queue_free()
		_seg_nodes[platform_index][seg_index] = null
	GameState.add_score(1)
	SaveManager.data["lifetime"]["segments_smashed"] += 1
	Haptics.light()
	AudioManager.play_sfx(&"shatter")

func _update_camera(delta: float) -> void:
	_cam_look_y = lerpf(_cam_look_y, _ball_y, clampf(delta * 8.0, 0.0, 1.0))
	var target := Vector3(RING_MID * 0.45, _cam_look_y - 1.0, 0.0)
	_camera.position = target + Vector3(1.2, 4.5, 6.0)
	_camera.look_at(target, Vector3.UP)

func _update_hud() -> void:
	var top := _platform_y(0)
	var bottom := _finish_y()
	var descended: float = clampf((top - _ball_y) / (top - bottom), 0.0, 1.0)
	_hud.set_progress(descended)
	_hud.set_score(GameState.run_score)

# --- Flow -------------------------------------------------------------------

func _on_level_clear() -> void:
	if _finished:
		return
	_finished = true
	_ball.position.y = _finish_y() + BALL_RADIUS + 0.15
	GameState.clear_level()
	SaveManager.record_best_score(GameState.current_level, GameState.run_score)
	SaveManager.data["lifetime"]["levels_cleared"] += 1
	Haptics.heavy()
	AudioManager.play_sfx(&"level_clear")
	_hud.show_end_panel("LEVEL CLEAR", GameState.run_score)

func _on_home() -> void:
	if _router and _router.has_method("go_to_home"):
		_router.go_to_home()

func _on_replay() -> void:
	if _router and _router.has_method("go_to_game"):
		_router.go_to_game()

# --- Helpers ----------------------------------------------------------------

func _platform_y(i: int) -> float:
	return -float(i) * PLATFORM_GAP

func _finish_y() -> float:
	return _platform_y(_platform_count - 1) - PLATFORM_GAP

func _segment_under_ball() -> int:
	# Ball sits at world angle 0; tower rotated by _tower_rot.
	var local := wrapf(-_tower_rot, 0.0, TAU)
	return int(floor(local / _seg_angle)) % SEGMENT_COUNT
