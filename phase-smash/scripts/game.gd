extends Node3D
## Gameplay driver. Rotating typed tower (per-platform rotation so boss levels
## can spin independent bands), scripted ball with the full Phase system, hard
## bounce, Fever, death + revive, and level-clear scoring/combo (§3). Level
## parameters come from LevelData via LevelLoader (§5).

const TowerGen := preload("res://scripts/tower_generator.gd")
const ShatterScript := preload("res://scripts/shatter.gd")
const HudScript := preload("res://scripts/hud.gd")

# --- Tuning (§4) ------------------------------------------------------------
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
const BOSS_BAND_SIZE := 5

# Juice (§6.3)
const SHAKE_DECAY := 0.9
const SHAKE_SHATTER := 0.018
const SHAKE_FEVER := 0.12
const HITSTOP := 0.03
# Lite FX auto-trigger (§8.4): >20ms avg for 5s
const LITE_FRAME_MS := 20.0
const LITE_HOLD_S := 5.0

const JuiceScript := preload("res://scripts/juice.gd")
const ThemesScript := preload("res://scripts/themes.gd")

enum State { PLAY, DEAD, REVIVING, FINISHED }

var _router: Node
var _level: LevelData
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
var _platform_nodes: Array = []    # Array[Node3D], one per platform (rotates)
var _platform_rot: Array = []      # Array[float] current radians
var _platform_speed: Array = []    # Array[float] rad/s
var _mat_by_kind: Dictionary = {}
var _platform_count: int = 30
var _segment_count: int = 8
var _seg_angle := TAU / 8.0

# Ball / run state
var _state: int = State.PLAY
var _ball_y := 0.0
var _ball_vy := 0.0
var _holding := false
var _phase: int = PSTypes.Phase.A
var _phase_duration := 2.5
var _phase_timer := 2.5
var _chain := 0
var _fever := false
var _fever_grace_timer := 0.0
var _input_lock_timer := 0.0
var _invuln_timer := 0.0
var _revive_used := false
var _revive_timer := 0.0
var _cleared := false

var _cam_look_y := 0.0
var _idle_bounce_v := 0.0
var _hard_bounce_v := 0.0

# Juice / FX
var _theme
var _env: Environment
var _trail: GPUParticles3D
var _fever_flame: GPUParticles3D
var _confetti: GPUParticles3D
var _shake := 0.0
var _lite := false            # effective Lite FX (setting or auto)
var _auto_lite := false
var _frame_over_timer := 0.0

func set_router(router: Node) -> void:
	_router = router

func _ready() -> void:
	_idle_bounce_v = sqrt(2.0 * GRAVITY_IDLE * IDLE_BOUNCE_HEIGHT)
	_hard_bounce_v = sqrt(2.0 * GRAVITY_IDLE * (HARD_BOUNCE_GAPS * PLATFORM_GAP))

	_level = LevelLoader.load_level(GameState.current_level)
	_platform_count = _level.platform_count
	_segment_count = _level.segment_count
	_seg_angle = TAU / float(_segment_count)
	_phase_duration = _level.phase_duration
	_phase_timer = _level.phase_duration
	_seg_kind = TowerGen.build(_level)

	_theme = ThemesScript.get_theme(_level.theme_id)
	_lite = bool(SaveManager.data["settings"].get("lite_fx", false))

	_setup_environment()
	_build_materials()
	_build_tower()
	_build_ball()
	_build_camera()
	_build_hud()
	_apply_phase_visuals()

	_ball_y = _platform_y(0) + START_DROP_GAPS * PLATFORM_GAP
	_cam_look_y = _ball_y
	GameState.start_level(_level.level_number)

# --- Construction -----------------------------------------------------------

func _setup_environment() -> void:
	var world := WorldEnvironment.new()
	var e := Environment.new()

	# Sky gradient from the theme (§6.4); boss levels darken the grade.
	var dark := 0.6 if _level.is_boss else 1.0
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = _theme.sky_top * dark
	sky_mat.sky_horizon_color = _theme.sky_horizon * dark
	sky_mat.ground_horizon_color = _theme.sky_horizon * dark
	sky_mat.ground_bottom_color = _theme.ground * dark
	var sky := Sky.new()
	sky.sky_material = sky_mat
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = _theme.ambient
	e.ambient_light_energy = 0.8

	# Cheap bloom-look glow (§6.2); off under Lite FX.
	e.glow_enabled = not _lite
	e.glow_intensity = 0.5
	e.glow_bloom = 0.15
	e.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE

	world.environment = e
	_env = e
	add_child(world)

	_dir_light = DirectionalLight3D.new()
	_dir_light.rotation = Vector3(deg_to_rad(-55), deg_to_rad(-30), 0)
	_dir_light.light_energy = 1.1
	if _level.is_boss:
		_dir_light.light_color = Color(1.0, 0.9, 0.55)  # gold rim (§5.1)
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

	var base_speed := deg_to_rad(_level.rotation_speed_deg)
	_broken.clear()
	_seg_nodes.clear()
	_platform_nodes.clear()
	_platform_rot.clear()
	_platform_speed.clear()

	for i in _platform_count:
		var pnode := Node3D.new()
		_tower.add_child(pnode)
		_platform_nodes.append(pnode)
		_platform_rot.append(0.0)
		_platform_speed.append(_band_speed(i, base_speed))

		var broken_row: Array[bool] = []
		var node_row: Array = []
		var py := _platform_y(i)
		for s in _segment_count:
			broken_row.append(false)
			var kind: int = _seg_kind[i][s]
			if kind == PSTypes.Seg.GAP:
				node_row.append(null)
			else:
				var seg := _make_segment_mesh(_mat_by_kind[kind])
				var a := (s + 0.5) * _seg_angle
				seg.position = Vector3(cos(a) * RING_MID, py, sin(a) * RING_MID)
				seg.rotation.y = -a
				pnode.add_child(seg)
				node_row.append(seg)
		_broken.append(broken_row)
		_seg_nodes.append(node_row)

	var pad := MeshInstance3D.new()
	var pad_mesh := CylinderMesh.new()
	pad_mesh.top_radius = RING_OUTER
	pad_mesh.bottom_radius = RING_OUTER
	pad_mesh.height = 0.3
	pad.mesh = pad_mesh
	pad.material_override = _emissive(_theme.finish, 0.7)
	pad.position = Vector3(0, _finish_y(), 0)
	add_child(pad)

	_confetti = JuiceScript.make_confetti(_lite)
	_confetti.position = Vector3(0, _finish_y() + 1.0, 0)
	add_child(_confetti)

## Boss levels split platforms into alternating bands that rotate independently
## (§5.1). Non-boss levels rotate uniformly.
func _band_speed(i: int, base_speed: float) -> float:
	if not _level.is_boss or _level.rotation_variance == 0.0:
		return base_speed
	var band := (i / BOSS_BAND_SIZE) % 2
	return base_speed if band == 0 else -base_speed * _level.rotation_variance

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

	# Ribbon-ish trail (phase-colored) + fever flame, ≤3 live systems (§6.2).
	_trail = JuiceScript.make_trail(PSTypes.phase_color(_phase), _lite)
	_ball.add_child(_trail)
	_fever_flame = JuiceScript.make_fever_flame(_lite)
	_ball.add_child(_fever_flame)

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
	_monitor_frame_time(delta)
	if _state == State.REVIVING and _revive_timer > 0.0:
		var before := ceili(_revive_timer)
		_revive_timer -= delta
		var after := ceili(_revive_timer)
		if after != before:
			_hud.set_revive_countdown(maxi(after, 0))
		if _revive_timer <= 0.0:
			_on_revive_decline()

func _physics_process(delta: float) -> void:
	for i in _platform_count:
		_platform_rot[i] += _platform_speed[i] * delta
		_platform_nodes[i].rotation.y = _platform_rot[i]
	if _state != State.PLAY:
		return

	_input_lock_timer = maxf(_input_lock_timer - delta, 0.0)
	_invuln_timer = maxf(_invuln_timer - delta, 0.0)
	_tick_phase(delta)
	_tick_fever(delta)

	var smashing := _effective_holding()
	var prev_bottom := _ball_y - BALL_RADIUS
	if smashing:
		_ball_vy = maxf(_ball_vy - SMASH_ACCEL * delta, -SMASH_TERMINAL)
	else:
		_ball_vy -= GRAVITY_IDLE * delta
	_ball_y += _ball_vy * delta
	var new_bottom := _ball_y - BALL_RADIUS

	if _ball_vy < 0.0:
		_resolve_descent(prev_bottom, new_bottom, smashing)

	if _state != State.PLAY:
		return
	if _ball_y - BALL_RADIUS <= _finish_y() + 0.3:
		_on_level_clear()
		return

	_ball.position.y = _ball_y
	_update_camera(delta, smashing)
	_update_hud()

## Auto "Lite FX": if the frame time stays above the budget for a sustained
## window, drop glow and thin particles (§8.4). Also honors the settings toggle.
func _monitor_frame_time(delta: float) -> void:
	if _auto_lite or _lite:
		return
	if delta * 1000.0 > LITE_FRAME_MS:
		_frame_over_timer += delta
		if _frame_over_timer >= LITE_HOLD_S:
			_enable_lite_fx()
	else:
		_frame_over_timer = maxf(_frame_over_timer - delta, 0.0)

func _enable_lite_fx() -> void:
	_auto_lite = true
	_lite = true
	if _env:
		_env.glow_enabled = false
	for p in [_trail, _fever_flame, _confetti]:
		if p:
			p.amount_ratio = 0.5

func _tick_phase(delta: float) -> void:
	if _effective_holding() and _ball_vy < 0.0:
		return  # paused while smash-descending (§3.4)
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
	if _fever_flame:
		_fever_flame.emitting = true
	_shake = SHAKE_FEVER
	_hud.flash(Color(1, 0.9, 0.6), 0.5)
	Haptics.heavy()
	AudioManager.play_sfx(&"fever")

func _end_fever() -> void:
	_fever = false
	if _fever_flame:
		_fever_flame.emitting = false
	_apply_phase_visuals()

func _resolve_descent(prev_bottom: float, new_bottom: float, smashing: bool) -> void:
	for i in _platform_count:
		var y_top := _platform_y(i) + PLATFORM_THICKNESS * 0.5
		if not (prev_bottom > y_top and new_bottom <= y_top):
			continue
		var seg_index := _segment_under(i)
		var kind: int = _seg_kind[i][seg_index]
		if kind == PSTypes.Seg.GAP or _broken[i][seg_index]:
			continue

		if not smashing:
			_ball_y = y_top + BALL_RADIUS
			_ball_vy = _idle_bounce_v
			return

		if _fever or _invuln_timer > 0.0:
			_shatter(i, seg_index, kind)
			continue
		if kind == PSTypes.Seg.OBSIDIAN:
			_die()
			return
		if PSTypes.is_matching(kind, _phase):
			_shatter(i, seg_index, kind)
			continue
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
	GameState.add_score(int(round(_combo_mult())))
	SaveManager.data["lifetime"]["segments_smashed"] += 1
	_shake = maxf(_shake, SHAKE_SHATTER * _combo_mult())  # scales with combo (§6.3)
	Haptics.light()
	AudioManager.play_sfx(&"shatter")
	if not _fever and _chain >= FEVER_THRESHOLD:
		_start_fever()

func _hard_bounce(y_top: float) -> void:
	_ball_y = y_top + BALL_RADIUS
	_ball_vy = _hard_bounce_v
	_chain = 0
	_input_lock_timer = INPUT_LOCK
	_hit_stop()
	Haptics.medium()
	AudioManager.play_sfx(&"hard_bounce")

## Brief freeze on impact (§6.3). Real-time timer so it lasts a fixed wall-clock
## duration regardless of the current time scale.
func _hit_stop() -> void:
	if _state != State.PLAY:
		return
	Engine.time_scale = 0.0
	get_tree().create_timer(HITSTOP, true, false, true).timeout.connect(_end_hit_stop)

func _end_hit_stop() -> void:
	if _state == State.PLAY:
		Engine.time_scale = 1.0

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
	_dir_light.light_energy = 0.4
	Engine.time_scale = DEATH_SLOWMO_SCALE
	get_tree().create_timer(DEATH_SLOWMO_TIME, true, false, true).timeout.connect(_after_death_slowmo)

func _after_death_slowmo() -> void:
	Engine.time_scale = 1.0
	if _state != State.DEAD:
		return
	if not _revive_used and _revive_available():
		_state = State.REVIVING
		_revive_timer = float(REVIVE_SECONDS)
		_hud.show_revive(REVIVE_SECONDS)
	else:
		_show_game_over()

func _revive_available() -> bool:
	return true  # P1 stub; becomes AdManager.is_rewarded_ready() in P5

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
	_hud.show_game_over(GameState.run_score, SaveManager.get_best_score(GameState.current_level))

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
	# +1 crate progress normally; a boss clear grants an instant crate (§7.2).
	var gain := 5 if _level.is_boss else 1
	SaveManager.data["crate_progress"] = int(SaveManager.data["crate_progress"]) + gain
	Haptics.heavy()
	AudioManager.play_sfx(&"level_clear")
	if _confetti:
		_confetti.restart()
		_confetti.emitting = true
	_shake = SHAKE_FEVER
	_hud.flash(Color(0.4, 1, 0.7), 0.4)
	_hud.show_level_clear(GameState.current_level, GameState.run_score,
		SaveManager.get_best_score(GameState.current_level))

# --- Visuals / HUD ----------------------------------------------------------

func _apply_phase_visuals() -> void:
	var c := PSTypes.phase_color(_phase)
	if _fever:
		c = Color(1, 0.95, 0.85)
	_ball_mat.albedo_color = c
	_ball_mat.emission = c
	_ball_mat.emission_energy_multiplier = 1.4 if _fever else 0.9
	_ball_light.light_color = c
	if _trail and _trail.process_material:
		var pm := _trail.process_material as ParticleProcessMaterial
		pm.color = c
		# Trail doubles in width during Fever (§6.3).
		pm.scale_min = 1.0 if _fever else 0.5
		pm.scale_max = 1.8 if _fever else 0.9
	if _hud:
		_hud.set_phase(PSTypes.phase_color(_phase))

func _update_camera(delta: float, smashing: bool) -> void:
	_cam_look_y = lerpf(_cam_look_y, _ball_y, clampf(delta * 8.0, 0.0, 1.0))
	var target := Vector3(RING_MID * 0.45, _cam_look_y - 1.0, 0.0)
	_camera.position = target + Vector3(1.2, 4.5, 6.0)
	_camera.look_at(target, Vector3.UP)
	# Screen shake: offset after aiming so the camera visibly jitters (§6.3).
	if _shake > 0.0001:
		_camera.position += Vector3(
			randf_range(-_shake, _shake),
			randf_range(-_shake, _shake),
			0.0)
		_shake = move_toward(_shake, 0.0, SHAKE_DECAY * delta)
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
	_hud.set_phase_ratio(_phase_timer / _phase_duration, _phase_timer <= PHASE_WARNING)
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

func _segment_under(i: int) -> int:
	var local := wrapf(-_platform_rot[i], 0.0, TAU)
	return int(floor(local / _seg_angle)) % _segment_count
