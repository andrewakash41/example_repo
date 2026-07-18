extends Node3D
## P1 gameplay: the full core mechanic. Rotating typed tower (amber/azure/
## obsidian/gap), a scripted ball with the Phase system, hard bounce, Fever,
## death + revive, and level-clear with scoring/combo (§3). Motion and collision
## are fully scripted — the ball is the only moving body (§8.4).

const TowerGen := preload("res://scripts/tower_generator.gd")
const ShatterScript := preload("res://scripts/shatter.gd")
const HudScript := preload("res://scripts/hud.gd")

# --- Tuning (§4; provisional, refined by the harness in P2) -----------------
const SEGMENT_COUNT := 8
const PLATFORM_GAP := 0.9
const PLATFORM_THICKNESS := 0.25
const RING_INNER := 0.5
const RING_OUTER := 2.4
const RING_MID := (RING_INNER + RING_OUTER) * 0.5
const BALL_RADIUS := 0.35

const SMASH_ACCEL := 150.0
const SMASH_TERMINAL := 22.0
const GRAVITY_IDLE := 40.0
const IDLE_BOUNCE_HEIGHT := 1.0
const HARD_BOUNCE_GAPS := 1.5
const START_DROP_GAPS := 3.0

const INPUT_LOCK := 0.2
const FEVER_THRESHOLD := 10
const FEVER_GRACE := 1.5
const BASE_FOV := 60.0
const SMASH_FOV_KICK := 3.0
const FEVER_FOV_KICK := 5.0
const PHASE_WARNING := 0.5
const REVIVE_SECONDS := 5
const INVULN := 1.5
const DEATH_SLOWMO_SCALE := 0.4
const DEATH_SLOWMO_TIME := 0.4

enum State { PLAY, DEAD, REVIVING, FINISHED }

var _router: Node
var _hud: Hud
var _tower: Node3D
var _ball: MeshInstance3D
var _ball_light: OmniLight3D
var _ball_mat: StandardMaterial3D
var _camera: Camera3D
var _dir_light: DirectionalLight3D

# Tower data
var _seg_kind: Array = []          # Array[Array[int]] PSTypes.Seg
var _broken: Array = []            # Array[Array[bool]]
var _seg_nodes: Array = []         # Array[Array[MeshInstance3D]]
var _mat_by_kind: Dictionary = {}
var _platform_count: int = 30
var _rot_speed := deg_to_rad(30.0)
var _tower_rot := 0.0

# Ball / run state
var _state: int = State.PLAY
var _ball_y := 0.0
var _ball_vy := 0.0
var _holding := false
var _phase: int = PSTypes.Phase.A
var _phase_duration := 2.5
var _phase_timer := 2.5
var _chain := 0                    # segments broken this uninterrupted hold
var _fever := false
var _fever_grace_timer := 0.0
var _input_lock_timer := 0.0
var _invuln_timer := 0.0
var _revive_used := false
var _revive_timer := 0.0
var _cleared := false

var _seg_angle := TAU / SEGMENT_COUNT
var _cam_look_y := 0.0
var _idle_bounce_v := 0.0
var _hard_bounce_v := 0.0

func set_router(router: Node) -> void:
	_router = router

func _ready() -> void:
	_idle_bounce_v = sqrt(2.0 * GRAVITY_IDLE * IDLE_BOUNCE_HEIGHT)
	_hard_bounce_v = sqrt(2.0 * GRAVITY_IDLE * (HARD_BOUNCE_GAPS * PLATFORM_GAP))

	var cfg := LevelLoader.load_level(GameState.current_level)
	_platform_count = cfg.platform_count
	_rot_speed = deg_to_rad(cfg.rotation_speed_deg)
	_phase_duration = cfg.phase_duration
	_phase_timer = cfg.phase_duration
	_seg_kind = TowerGen.generate(
		cfg.platform_count, cfg.segment_count,
		cfg.gap_pct, cfg.obsidian_pct, cfg.color_bias, cfg.seed_value)

	_setup_environment()
	_build_materials()
	_build_tower()
	_build_ball()
	_build_camera()
	_build_hud()
	_apply_phase_visuals()

	_ball_y = _platform_y(0) + START_DROP_GAPS * PLATFORM_GAP
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

	_dir_light = DirectionalLight3D.new()
	_dir_light.rotation = Vector3(deg_to_rad(-55), deg_to_rad(-30), 0)
	_dir_light.light_energy = 1.1
	add_child(_dir_light)

func _build_materials() -> void:
	_mat_by_kind[PSTypes.Seg.AMBER] = _emissive(PSTypes.AMBER_COLOR, 0.8)
	_mat_by_kind[PSTypes.Seg.AZURE] = _emissive(PSTypes.AZURE_COLOR, 0.8)
	var obs := StandardMaterial3D.new()
	obs.albedo_color = PSTypes.OBSIDIAN_COLOR
	obs.metallic = 0.6
	obs.roughness = 0.2
	obs.emission_enabled = true
	obs.emission = PSTypes.OBSIDIAN_RIM
	obs.emission_energy_multiplier = 0.4
	_mat_by_kind[PSTypes.Seg.OBSIDIAN] = obs

func _emissive(c: Color, energy: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	return m

func _build_tower() -> void:
	_tower = Node3D.new()
	_tower.name = "Tower"
	add_child(_tower)

	_broken.clear()
	_seg_nodes.clear()
	for i in _platform_count:
		var broken_row: Array[bool] = []
		var node_row: Array = []
		var py := _platform_y(i)
		for s in SEGMENT_COUNT:
			broken_row.append(false)
			var kind: int = _seg_kind[i][s]
			if kind == PSTypes.Seg.GAP:
				node_row.append(null)
			else:
				var seg := _make_segment_mesh(_mat_by_kind[kind])
				var a := (s + 0.5) * _seg_angle
				seg.position = Vector3(cos(a) * RING_MID, py, sin(a) * RING_MID)
				seg.rotation.y = -a
				_tower.add_child(seg)
				node_row.append(seg)
		_broken.append(broken_row)
		_seg_nodes.append(node_row)

	var pad := MeshInstance3D.new()
	var pad_mesh := CylinderMesh.new()
	pad_mesh.top_radius = RING_OUTER
	pad_mesh.bottom_radius = RING_OUTER
	pad_mesh.height = 0.3
	pad.mesh = pad_mesh
	pad.material_override = _emissive(Color(0.2, 0.9, 0.5), 0.7)
	pad.position = Vector3(0, _finish_y(), 0)
	add_child(pad)

func _make_segment_mesh(mat: StandardMaterial3D) -> MeshInstance3D:
	var seg := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	var tangential := 2.0 * RING_MID * tan(_seg_angle * 0.5) * 0.92
	mesh.size = Vector3(RING_OUTER - RING_INNER, PLATFORM_THICKNESS, tangential)
	seg.mesh = mesh
	seg.material_override = mat
	return seg

func _build_ball() -> void:
	_ball = MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = BALL_RADIUS
	mesh.height = BALL_RADIUS * 2.0
	_ball.mesh = mesh
	_ball_mat = _emissive(PSTypes.AMBER_COLOR, 0.9)
	_ball.material_override = _ball_mat
	_ball.position = Vector3(RING_MID, 0, 0)
	add_child(_ball)

	_ball_light = OmniLight3D.new()
	_ball_light.omni_range = 4.0
	_ball_light.light_energy = 1.5
	_ball.add_child(_ball_light)

func _build_camera() -> void:
	_camera = Camera3D.new()
	_camera.fov = BASE_FOV
	add_child(_camera)
	_camera.current = true

func _build_hud() -> void:
	_hud = HudScript.new()
	add_child(_hud)
	_hud.home_pressed.connect(_on_home)
	_hud.replay_pressed.connect(_on_replay)
	_hud.revive_pressed.connect(_on_revive_accept)
	_hud.revive_declined.connect(_on_revive_decline)

# --- Input ------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if _state != State.PLAY:
		return
	var pressed := false
	var changed := false
	if event is InputEventScreenTouch:
		pressed = event.pressed
		changed = true
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		pressed = event.pressed
		changed = true
	if changed:
		_holding = pressed
		if _holding:
			_hud.hide_hint()

func _effective_holding() -> bool:
	return _holding and _input_lock_timer <= 0.0

# --- Per-frame --------------------------------------------------------------

func _process(delta: float) -> void:
	# Revive countdown ticks in real time (slow-mo already restored).
	if _state == State.REVIVING and _revive_timer > 0.0:
		var before := ceili(_revive_timer)
		_revive_timer -= delta
		var after := ceili(_revive_timer)
		if after != before:
			_hud.set_revive_countdown(maxi(after, 0))
		if _revive_timer <= 0.0:
			_on_revive_decline()

func _physics_process(delta: float) -> void:
	_tower_rot += _rot_speed * delta
	_tower.rotation.y = _tower_rot
	if _state != State.PLAY:
		return

	_input_lock_timer = maxf(_input_lock_timer - delta, 0.0)
	_invuln_timer = maxf(_invuln_timer - delta, 0.0)
	_tick_phase(delta)
	_tick_fever(delta)

	var smashing := _effective_holding()
	var seg_index := _segment_under_ball()

	var prev_bottom := _ball_y - BALL_RADIUS
	if smashing:
		_ball_vy = maxf(_ball_vy - SMASH_ACCEL * delta, -SMASH_TERMINAL)
	else:
		_ball_vy -= GRAVITY_IDLE * delta
	_ball_y += _ball_vy * delta
	var new_bottom := _ball_y - BALL_RADIUS

	if _ball_vy < 0.0:
		_resolve_descent(prev_bottom, new_bottom, seg_index, smashing)

	if _state != State.PLAY:
		return
	if _ball_y - BALL_RADIUS <= _finish_y() + 0.3:
		_on_level_clear()
		return

	_ball.position.y = _ball_y
	_update_camera(delta, smashing)
	_update_hud()

func _tick_phase(delta: float) -> void:
	# Phase timer pauses while actively smash-descending (§3.4).
	if _effective_holding() and _ball_vy < 0.0:
		return
	_phase_timer -= delta
	if _phase_timer <= 0.0:
		_flip_phase()

func _flip_phase() -> void:
	_phase = PSTypes.other_phase(_phase)
	_phase_timer = _phase_duration
	_apply_phase_visuals()
	_hud.flash(PSTypes.phase_color(_phase), 0.35)
	Haptics.medium()
	AudioManager.play_sfx(&"phase_flip")

func _tick_fever(delta: float) -> void:
	if not _fever:
		return
	if _effective_holding():
		_fever_grace_timer = FEVER_GRACE
	else:
		_fever_grace_timer -= delta
		if _fever_grace_timer <= 0.0:
			_end_fever()

func _start_fever() -> void:
	if _fever:
		return
	_fever = true
	_fever_grace_timer = FEVER_GRACE
	_apply_phase_visuals()
	_hud.flash(Color(1, 0.9, 0.6), 0.5)
	Haptics.heavy()
	AudioManager.play_sfx(&"fever")

func _end_fever() -> void:
	_fever = false
	_apply_phase_visuals()

## Sweeps platforms crossed this tick and applies the §3 interaction rules.
func _resolve_descent(prev_bottom: float, new_bottom: float, seg_index: int, smashing: bool) -> void:
	for i in _platform_count:
		var y_top := _platform_y(i) + PLATFORM_THICKNESS * 0.5
		if not (prev_bottom > y_top and new_bottom <= y_top):
			continue
		var kind: int = _seg_kind[i][seg_index]
		if kind == PSTypes.Seg.GAP or _broken[i][seg_index]:
			continue  # nothing there — fall through

		if not smashing:
			# Idle bounce: any solid (including obsidian) is safe to bounce on.
			_ball_y = y_top + BALL_RADIUS
			_ball_vy = _idle_bounce_v
			return

		# Smashing.
		if _fever or _invuln_timer > 0.0:
			_shatter(i, seg_index, kind)          # fever/invuln smashes everything
			continue
		if kind == PSTypes.Seg.OBSIDIAN:
			_die()
			return
		if PSTypes.is_matching(kind, _phase):
			_shatter(i, seg_index, kind)
			continue
		# Opposite color while smashing -> hard bounce, not death.
		_hard_bounce(y_top)
		return

func _shatter(platform_index: int, seg_index: int, kind: int) -> void:
	_broken[platform_index][seg_index] = true
	var node: MeshInstance3D = _seg_nodes[platform_index][seg_index]
	if node and is_instance_valid(node):
		ShatterScript.burst(self, node.global_position, PSTypes.seg_color(kind))
		node.queue_free()
		_seg_nodes[platform_index][seg_index] = null

	_chain += 1
	var points := int(round(_combo_mult()))
	GameState.add_score(points)
	SaveManager.data["lifetime"]["segments_smashed"] += 1
	Haptics.light()
	AudioManager.play_sfx(&"shatter")
	if not _fever and _chain >= FEVER_THRESHOLD:
		_start_fever()

func _hard_bounce(y_top: float) -> void:
	_ball_y = y_top + BALL_RADIUS
	_ball_vy = _hard_bounce_v
	_chain = 0
	_input_lock_timer = INPUT_LOCK
	Haptics.medium()
	AudioManager.play_sfx(&"hard_bounce")

func _combo_mult() -> float:
	return clampf(1.0 + float(_chain) / 10.0, 1.0, 5.0)

# --- Death / revive ---------------------------------------------------------

func _die() -> void:
	if _state != State.PLAY:
		return
	_state = State.DEAD
	_chain = 0
	_fever = false
	SaveManager.data["lifetime"]["deaths"] += 1
	GameState.die()
	Haptics.heavy()
	AudioManager.play_sfx(&"death")
	ShatterScript.burst(self, _ball.global_position, Color(1, 0.9, 0.8))
	_ball.visible = false
	_dir_light.light_energy = 0.4  # tower dims
	Engine.time_scale = DEATH_SLOWMO_SCALE
	# Real-time timer so slow-mo lasts a fixed wall-clock duration.
	get_tree().create_timer(DEATH_SLOWMO_TIME, true, false, true).timeout.connect(_after_death_slowmo)

func _after_death_slowmo() -> void:
	Engine.time_scale = 1.0
	if _state != State.DEAD:
		return
	# Only offer revive if it can actually work (§3.6): once/level, and an ad is
	# available. P1 uses a stubbed rewarded ad that is always "ready".
	if not _revive_used and _revive_available():
		_state = State.REVIVING
		_revive_timer = float(REVIVE_SECONDS)
		_hud.show_revive(REVIVE_SECONDS)
	else:
		_show_game_over()

func _revive_available() -> bool:
	# P1: stubbed fake ad is always ready. In P5 this becomes
	# AdManager.is_rewarded_ready().
	return true

func _on_revive_accept() -> void:
	if _state != State.REVIVING:
		return
	_revive_used = true
	_hud.show_fake_ad(_do_revive)

func _do_revive() -> void:
	_hud.clear_overlay()
	_state = State.PLAY
	_ball.visible = true
	_dir_light.light_energy = 1.1
	_ball_vy = 0.0
	_invuln_timer = INVULN
	_apply_phase_visuals()

func _on_revive_decline() -> void:
	if _state != State.REVIVING and _state != State.DEAD:
		return
	_show_game_over()

func _show_game_over() -> void:
	_state = State.FINISHED
	Engine.time_scale = 1.0
	var best := SaveManager.get_best_score(GameState.current_level)
	_hud.show_game_over(GameState.run_score, best)

# --- Level clear ------------------------------------------------------------

func _on_level_clear() -> void:
	if _state == State.FINISHED:
		return
	_state = State.FINISHED
	_cleared = true
	_ball.visible = true
	_ball.position.y = _finish_y() + BALL_RADIUS + 0.15
	GameState.clear_level()
	SaveManager.record_best_score(GameState.current_level, GameState.run_score)
	SaveManager.data["lifetime"]["levels_cleared"] += 1
	SaveManager.data["crate_progress"] = int(SaveManager.data["crate_progress"]) + 1
	Haptics.heavy()
	AudioManager.play_sfx(&"level_clear")
	_hud.flash(Color(0.4, 1, 0.7), 0.4)
	var best := SaveManager.get_best_score(GameState.current_level)
	_hud.show_level_clear(GameState.current_level, GameState.run_score, best)

# --- Visuals / HUD ----------------------------------------------------------

func _apply_phase_visuals() -> void:
	var c := PSTypes.phase_color(_phase)
	if _fever:
		c = Color(1, 0.95, 0.85)  # white-hot
	_ball_mat.albedo_color = c
	_ball_mat.emission = c
	_ball_mat.emission_energy_multiplier = 1.4 if _fever else 0.9
	_ball_light.light_color = c
	if _hud:
		_hud.set_phase(PSTypes.phase_color(_phase))

func _update_camera(delta: float, smashing: bool) -> void:
	_cam_look_y = lerpf(_cam_look_y, _ball_y, clampf(delta * 8.0, 0.0, 1.0))
	var target := Vector3(RING_MID * 0.45, _cam_look_y - 1.0, 0.0)
	_camera.position = target + Vector3(1.2, 4.5, 6.0)
	_camera.look_at(target, Vector3.UP)
	var want_fov := BASE_FOV
	if _fever:
		want_fov += FEVER_FOV_KICK
	elif smashing:
		want_fov += SMASH_FOV_KICK
	_camera.fov = lerpf(_camera.fov, want_fov, clampf(delta * 6.0, 0.0, 1.0))

func _update_hud() -> void:
	var top := _platform_y(0)
	var bottom := _finish_y()
	_hud.set_progress(clampf((top - _ball_y) / (top - bottom), 0.0, 1.0))
	_hud.set_score(GameState.run_score)
	_hud.set_combo(_combo_mult())
	var ratio := _phase_timer / _phase_duration
	_hud.set_phase_ratio(ratio, _phase_timer <= PHASE_WARNING)
	var fever_ratio := 1.0 if _fever else float(_chain) / float(FEVER_THRESHOLD)
	_hud.set_fever(fever_ratio, _fever)

# --- Flow -------------------------------------------------------------------

func _on_home() -> void:
	Engine.time_scale = 1.0
	if _router and _router.has_method("go_to_home"):
		_router.go_to_home()

func _on_replay() -> void:
	Engine.time_scale = 1.0
	if _cleared:
		GameState.advance_level()
	if _router and _router.has_method("go_to_game"):
		_router.go_to_game()

# --- Helpers ----------------------------------------------------------------

func _platform_y(i: int) -> float:
	return -float(i) * PLATFORM_GAP

func _finish_y() -> float:
	return _platform_y(_platform_count - 1) - PLATFORM_GAP

func _segment_under_ball() -> int:
	var local := wrapf(-_tower_rot, 0.0, TAU)
	return int(floor(local / _seg_angle)) % SEGMENT_COUNT
