extends Node3D
## Gameplay driver. Rotating typed tower (per-platform rotation so boss levels
## can spin independent bands), scripted ball with the full Phase system, hard
## bounce, Fever, death + revive, and level-clear scoring/combo (§3). Level
## parameters come from LevelData via LevelLoader (§5).

const TowerGen := preload("res://scripts/tower_generator.gd")
const ShatterPoolScript := preload("res://scripts/shatter.gd")
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

# Windowed tower view (§8.4, B2): only the platforms near the ball have live
# nodes. WINDOW_BELOW must stay well ahead of the fastest descent so a platform
# is always built before the ball can reach it; WINDOW_ABOVE keeps just-passed
# platforms visible through idle/hard bounces (which push up ~1.5 gaps).
const WINDOW_ABOVE := 4
const WINDOW_BELOW := 14

const INPUT_LOCK := 0.2
const FEVER_THRESHOLD_DEFAULT := 10  # fallback; per-level value comes from LevelData (B9)
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

# REVIVE_PENDING: the player accepted the revive and the rewarded ad is showing.
# The revive countdown must NOT run in this state (B1 race fix) — the ad can take
# longer than the countdown, and letting it expire mid-ad drove a game-over that
# then had the reward callback flip the state back to PLAY underneath it.
enum State { PLAY, DEAD, REVIVING, REVIVE_PENDING, FINISHED }

var _router: Node
var _level: LevelData
var _hud: Hud
var _tower: Node3D
var _ball: MeshInstance3D
var _ball_light: OmniLight3D
var _ball_mat: StandardMaterial3D
var _phase_ring: MeshInstance3D          # depleting phase ring at the ball (B11)
var _phase_ring_mat: StandardMaterial3D
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
var _win_lo: int = 0               # live-node window [_win_lo, _win_hi) (B2)
var _win_hi: int = 0

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
var _cleared_level := 0
var _crate2x_used := false
var _fever_threshold := FEVER_THRESHOLD_DEFAULT  # per-level (B9)
var _last_clear_gain := 0                         # crate progress granted this clear (B12)

var _cam_look_y := 0.0
var _idle_bounce_v := 0.0
var _hard_bounce_v := 0.0

# Juice / FX
var _theme
var _env: Environment
var _trail: GPUParticles3D
var _fever_flame: GPUParticles3D
var _confetti: GPUParticles3D
var _shatter_pool: ShatterPool
var _shake := 0.0
var _lite := false            # effective Lite FX (setting or auto)
var _auto_lite := false
var _frame_over_timer := 0.0

# Boosters / skin (§7)
var _shield := false
var _slow_mo_mult := 1.0
var _consumed_boosters: Dictionary = {}   # what consume_equipped took this level (B6)
var _boosters_refunded := false           # guard so a run refunds at most once (B6)
var _skin

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
	_fever_threshold = _level.fever_threshold
	_seg_kind = TowerGen.build(_level)

	_theme = ThemesScript.get_theme(_level.theme_id)
	_lite = bool(SaveManager.data["settings"].get("lite_fx", false))
	Haptics.enabled = bool(SaveManager.data["settings"].get("haptics", true))
	_skin = Skins.get_skin(SaveManager.data["equipped_skin"])

	# Consume equipped boosters at level start and apply their effects (§7.1).
	# Consuming at start is the anti-exploit choice; unused ones are refunded when
	# the run ends without the effect firing (B6, see _refund_boosters).
	var active := Boosters.consume_equipped(SaveManager.data)
	_consumed_boosters = active
	_shield = active.has("shield")
	_slow_mo_mult = Boosters.SLOW_MO_FACTOR if active.has("slow_mo") else 1.0
	SaveManager.save_game()

	_setup_environment()
	_build_materials()
	_build_tower()
	_build_ball()
	_build_camera()
	_build_hud()
	# Intro hint shows only until the player has smashed once, ever (B10).
	if _hint_seen("intro"):
		_hud.hide_hint()
	_apply_phase_visuals()

	_ball_y = _platform_y(0) + START_DROP_GAPS * PLATFORM_GAP
	if active.has("head_start"):
		_apply_head_start()
	_cam_look_y = _ball_y
	_update_window()  # build the initial live window around the ball (B2)
	# Boss levels get the heavier loop; everything else the standard gameplay bed
	# (§6.5). No-ops silently until the OGG assets are dropped in (B4).
	AudioManager.play_music(&"boss" if _level.is_boss else &"game")
	AdManager.notify_level_started()
	GameState.start_level(_level.level_number)

## Auto-clears the top fraction of the tower (§7.1). Marks those segments broken
## in the data model; the windowed view (B2) simply never builds nodes for the
## skipped band, and the ball starts just below it.
func _apply_head_start() -> void:
	var cut := int(_platform_count * Boosters.HEAD_START_FRACTION)
	for i in cut:
		for s in _segment_count:
			if _seg_kind[i][s] != PSTypes.Seg.GAP:
				_broken[i][s] = true
	_ball_y = _platform_y(cut) + START_DROP_GAPS * PLATFORM_GAP

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

	var base_speed := deg_to_rad(_level.rotation_speed_deg) * _slow_mo_mult
	_broken.clear()
	_seg_nodes.clear()
	_platform_nodes.clear()
	_platform_rot.clear()
	_platform_speed.clear()

	# Build the full DATA model for every platform (cheap arrays), but leave the
	# VIEW empty — nodes are spawned lazily by _update_window (B2). Keeping all
	# rotation/broken state here means gameplay and the harness bot are unaffected.
	for i in _platform_count:
		_platform_nodes.append(null)
		_platform_rot.append(0.0)
		_platform_speed.append(_band_speed(i, base_speed))
		var broken_row: Array[bool] = []
		for s in _segment_count:
			broken_row.append(false)
		_broken.append(broken_row)
		_seg_nodes.append([])
	_win_lo = 0
	_win_hi = 0

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

	_shatter_pool = ShatterPoolScript.new()
	add_child(_shatter_pool)

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

# --- Windowed tower view (B2) ----------------------------------------------

func _platform_index_at(y: float) -> int:
	return clampi(int(round(-y / PLATFORM_GAP)), 0, _platform_count - 1)

## Keeps live nodes only for platforms in [ball-ABOVE, ball+BELOW]. Frees nodes
## that fell out of the window and builds the ones that entered it. Cheap and
## idempotent: called every physics frame, does nothing while the window is stable.
func _update_window() -> void:
	var centre := _platform_index_at(_ball_y)
	var lo := maxi(centre - WINDOW_ABOVE, 0)
	var hi := mini(centre + WINDOW_BELOW + 1, _platform_count)
	if lo == _win_lo and hi == _win_hi:
		return
	for i in range(_win_lo, _win_hi):
		if i < lo or i >= hi:
			_free_platform(i)
	for i in range(lo, hi):
		if i < _win_lo or i >= _win_hi or _platform_nodes[i] == null:
			_spawn_platform(i)
	_win_lo = lo
	_win_hi = hi

func _spawn_platform(i: int) -> void:
	if _platform_nodes[i] != null and is_instance_valid(_platform_nodes[i]):
		return
	var pnode := Node3D.new()
	pnode.rotation.y = _platform_rot[i]
	_tower.add_child(pnode)
	var py := _platform_y(i)
	var node_row: Array = []
	for s in _segment_count:
		var kind: int = _seg_kind[i][s]
		if kind == PSTypes.Seg.GAP or _broken[i][s]:
			node_row.append(null)
			continue
		var seg := _make_segment_mesh(_mat_by_kind[kind])
		var a := (s + 0.5) * _seg_angle
		seg.position = Vector3(cos(a) * RING_MID, py, sin(a) * RING_MID)
		seg.rotation.y = -a
		pnode.add_child(seg)
		node_row.append(seg)
	_platform_nodes[i] = pnode
	_seg_nodes[i] = node_row

func _free_platform(i: int) -> void:
	var pnode = _platform_nodes[i]
	if pnode != null and is_instance_valid(pnode):
		pnode.queue_free()  # frees its child segment meshes too
	_platform_nodes[i] = null
	_seg_nodes[i] = []

func _build_ball() -> void:
	_ball = MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = BALL_RADIUS
	mesh.height = BALL_RADIUS * 2.0
	_ball.mesh = mesh
	_ball_mat = _emissive(PSTypes.AMBER_COLOR, 0.9)
	_ball_mat.metallic = _skin.metallic
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

	# Phase ring around the ball (§3.4, B11): the phase color lives where the
	# player's eyes are, not just in the bottom HUD bar. Emission brightens as the
	# phase depletes and the ring pulses in the last 0.5s before a flip.
	_phase_ring = MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = BALL_RADIUS + 0.16
	ring.outer_radius = BALL_RADIUS + 0.26
	_phase_ring.mesh = ring
	_phase_ring_mat = _emissive(PSTypes.phase_color(_phase), 1.2)
	_phase_ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_phase_ring.material_override = _phase_ring_mat
	_ball.add_child(_phase_ring)

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
	_hud.crate2x_pressed.connect(_on_crate_2x)
	_hud.pause_pressed.connect(_on_pause_pressed)
	_hud.resume_pressed.connect(_resume)
	_hud.restart_pressed.connect(_on_restart)
	# HUD must keep processing while the tree is paused so the menu works.
	_hud.process_mode = Node.PROCESS_MODE_ALWAYS

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
			_mark_hint_seen("intro")  # B10: intro shown once ever

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
	# Advance rotation for ALL platforms (data — keeps collision deterministic and
	# bot-faithful), but only push it to the live nodes in the window (B2).
	for i in _platform_count:
		_platform_rot[i] += _platform_speed[i] * delta
	for i in range(_win_lo, _win_hi):
		var pnode = _platform_nodes[i]
		if pnode != null:
			pnode.rotation.y = _platform_rot[i]
	_update_window()
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
	AudioManager.set_fever_layer(true)   # fade in the additive stem (§6.5, B4)

func _end_fever() -> void:
	_fever = false
	if _fever_flame:
		_fever_flame.emitting = false
	AudioManager.set_fever_layer(false)  # fade the stem back out (B4)
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
			if _shield:
				_pop_shield()
				_shatter(i, seg_index, kind)
				continue
			_die()
			return
		if PSTypes.is_matching(kind, _phase):
			_shatter(i, seg_index, kind)
			continue
		_hard_bounce(y_top)
		return

func _shatter(platform_index: int, seg_index: int, kind: int) -> void:
	_broken[platform_index][seg_index] = true
	# The row is populated whenever the platform is in the live window — which it
	# always is when the ball is crossing it — but guard anyway (B2).
	var row: Array = _seg_nodes[platform_index]
	var node: MeshInstance3D = row[seg_index] if seg_index < row.size() else null
	if node and is_instance_valid(node):
		_shatter_pool.burst(node.global_position, PSTypes.seg_color(kind))
		node.queue_free()
		row[seg_index] = null

	_chain += 1
	GameState.add_score(int(round(_combo_mult())))
	SaveManager.data["lifetime"]["segments_smashed"] += 1
	_shake = maxf(_shake, SHAKE_SHATTER * _combo_mult())  # scales with combo (§6.3)
	Haptics.light()
	AudioManager.play_sfx(&"shatter")
	if not _fever and _chain >= _fever_threshold:
		_start_fever()

func _hard_bounce(y_top: float) -> void:
	_ball_y = y_top + BALL_RADIUS
	_ball_vy = _hard_bounce_v
	_chain = 0
	_input_lock_timer = INPUT_LOCK
	Haptics.medium()
	AudioManager.play_sfx(&"hard_bounce")
	# First time a wrong-color bounce ever happens, teach the lesson: a contextual
	# hint plus a one-time 0.3x beat so the flip is easy to read (§5.3, B10). That
	# longer slow-mo replaces the usual micro hit-stop for this one bounce so the
	# two time-scale timers don't fight.
	if not _hint_seen("opposite"):
		_mark_hint_seen("opposite")
		_hud.show_hint_text("Wait for the color flip!", 2.5)
		_first_opposite_slowmo()
	else:
		_hit_stop()

## One-shot 0.3x time-slow on the first opposite-color encounter (B10). Wall-clock
## timer so its duration is independent of the current time scale.
func _first_opposite_slowmo() -> void:
	if _state != State.PLAY:
		return
	Engine.time_scale = 0.3
	get_tree().create_timer(0.5, true, false, true).timeout.connect(_end_first_opposite_slowmo)

func _end_first_opposite_slowmo() -> void:
	if _state == State.PLAY:
		Engine.time_scale = 1.0

func _hint_seen(id: String) -> bool:
	return bool(SaveManager.data["hints_seen"].get(id, false))

func _mark_hint_seen(id: String) -> void:
	if _hint_seen(id):
		return
	SaveManager.data["hints_seen"][id] = true
	SaveManager.save_game()

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

func _pop_shield() -> void:
	_shield = false
	_shake = maxf(_shake, SHAKE_FEVER)
	_hud.flash(Color(0.4, 0.8, 1.0), 0.4)
	Haptics.medium()
	AudioManager.play_sfx(&"hard_bounce")

## Return boosters the player never got value from when the run ends early (B6).
## Matrix (also logged in DECISIONS.md):
##   shield     -> refunded whenever it never popped (_shield still true)
##   slow_mo    -> refunded on restart only (on a real loss the run used it)
##   head_start -> never refunded (the skip was already granted)
func _refund_boosters(on_restart: bool) -> void:
	if _boosters_refunded:
		return
	# _shield is still true iff the shield was never popped this run.
	var refund := Boosters.refund_on_end(_consumed_boosters, _shield, on_restart)
	for id in refund:
		Boosters.grant(SaveManager.data, id, 1)
	if not refund.is_empty():
		SaveManager.save_game()
	_boosters_refunded = true

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
	_shatter_pool.burst(_ball.global_position, Color(1, 0.9, 0.8))
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
	# §3.6: only offer revive if a rewarded ad can actually play.
	return AdManager.is_rewarded_ready()

func _on_revive_accept() -> void:
	if _state != State.REVIVING:
		return
	_revive_used = true  # max 1/level (§9.2 placement 2)
	# Leave REVIVING and stop the countdown *before* the ad shows so it can't
	# expire mid-ad into a game-over (B1).
	_state = State.REVIVE_PENDING
	_revive_timer = 0.0
	AdManager.show_rewarded(AdConfig.Placement.REVIVE, _do_revive, _on_revive_ad_dismissed)

func _do_revive() -> void:
	if _state != State.REVIVE_PENDING:
		return  # only revive from a live accept (B1)
	_hud.clear_overlay()
	_state = State.PLAY
	_ball.visible = true
	_dir_light.light_energy = 1.1
	_ball_vy = 0.0
	_invuln_timer = INVULN
	_apply_phase_visuals()

## Rewarded ad closed without a reward (unavailable / user skipped): end the run.
func _on_revive_ad_dismissed() -> void:
	if _state == State.REVIVE_PENDING:
		_show_game_over()

func _on_revive_decline() -> void:
	if _state != State.REVIVING and _state != State.DEAD:
		return
	_show_game_over()

func _show_game_over() -> void:
	if _state == State.FINISHED:
		return
	_state = State.FINISHED
	Engine.time_scale = 1.0
	_refund_boosters(false)  # B6: unused shield comes back on a lost run
	_hud.show_game_over(GameState.run_score, SaveManager.get_best_score(GameState.current_level))

# --- Level clear ------------------------------------------------------------

func _on_level_clear() -> void:
	if _state == State.FINISHED:
		return
	_state = State.FINISHED
	_cleared = true
	_ball.visible = true
	_ball.position.y = _finish_y() + BALL_RADIUS + 0.15
	var cleared_level := GameState.current_level
	_cleared_level = cleared_level
	AdManager.notify_level_completed()
	GameState.clear_level()
	SaveManager.record_best_score(cleared_level, GameState.run_score)
	SaveManager.data["lifetime"]["levels_cleared"] += 1
	# +1 crate progress normally; a boss clear grants an instant crate (§7.2).
	var gain := 5 if _level.is_boss else 1
	_last_clear_gain = gain  # B12: 2x-crate ad doubles the *actual* gain
	SaveManager.data["crate_progress"] = int(SaveManager.data["crate_progress"]) + gain
	Boosters.on_level_clear(SaveManager.data)  # periodic free shield (§7.1)
	GameState.advance_level()                  # unlock the next level
	SaveManager.save_game()                    # persist on level clear (§8.3)
	Haptics.heavy()
	AudioManager.play_sfx(&"level_clear")
	if _confetti:
		_confetti.restart()
		_confetti.emitting = true
	_shake = SHAKE_FEVER
	_hud.flash(Color(0.4, 1, 0.7), 0.4)
	_hud.show_level_clear(cleared_level, GameState.run_score,
		SaveManager.get_best_score(cleared_level))

# --- Visuals / HUD ----------------------------------------------------------

func _apply_phase_visuals() -> void:
	var c := PSTypes.phase_color(_phase)
	if _fever:
		c = Color(1, 0.95, 0.85)
	# Albedo keeps the skin's identity; emission carries the phase color so
	# readability survives on every skin (§7.3).
	_ball_mat.albedo_color = _skin.base.lerp(c, 0.4) if _skin else c
	_ball_mat.emission = c
	_ball_mat.emission_energy_multiplier = (1.4 if _fever else 0.9) * (_skin.emission_energy if _skin else 1.0)
	_ball_light.light_color = c
	if _phase_ring_mat:
		_phase_ring_mat.albedo_color = Color(c.r, c.g, c.b, _phase_ring_mat.albedo_color.a)
		_phase_ring_mat.emission = c
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
	var phase_ratio := _phase_timer / _phase_duration
	var warning := _phase_timer <= PHASE_WARNING
	_hud.set_phase_ratio(phase_ratio, warning)
	_update_phase_ring(phase_ratio, warning)
	var fever_ratio := 1.0 if _fever else float(_chain) / float(_fever_threshold)
	_hud.set_fever(fever_ratio, _fever)

## Ring readout at the ball (B11): brighter as the phase depletes (ratio 1->0),
## with a fast alpha pulse in the warning window just before the flip.
func _update_phase_ring(ratio: float, warning: bool) -> void:
	if not _phase_ring_mat:
		return
	_phase_ring_mat.emission_energy_multiplier = lerpf(1.0, 2.6, 1.0 - ratio)
	var alpha := 1.0
	if warning:
		alpha = 0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.02)
	_phase_ring_mat.albedo_color.a = alpha

# --- Flow -------------------------------------------------------------------

func _on_home() -> void:
	Engine.time_scale = 1.0
	# Quitting mid-run without popping the shield shouldn't cost it (B6). A clear
	# already refunded/kept via _on_level_clear; this covers abandon-to-home.
	if not _cleared:
		_refund_boosters(false)
	if _router and _router.has_method("go_to_home"):
		_router.go_to_home()

func _on_replay() -> void:
	# After a clear the level was already advanced (§ _on_level_clear), so NEXT
	# just reloads at the new current level; after a game over it retries the same.
	Engine.time_scale = 1.0
	if _cleared:
		# Post-level interstitial gate on the NEXT tap (§9.2 placement 1). Always
		# proceeds whether or not an ad shows (fail-silent).
		AdManager.maybe_show_interstitial(_cleared_level, _goto_game)
	else:
		_goto_game()

func _goto_game() -> void:
	if _router and _router.has_method("go_to_game"):
		_router.go_to_game()

## 2x crate progress via rewarded ad on the level-clear screen (§3.7, §9.2).
func _on_crate_2x() -> void:
	if _crate2x_used:
		return
	_crate2x_used = true
	AdManager.show_rewarded(AdConfig.Placement.CRATE_2X, _grant_crate_2x, _on_crate_2x_fail)

func _grant_crate_2x() -> void:
	# Doubles this clear's crate contribution: add the same amount already granted
	# at clear, so a boss's +5 becomes +10 (B12) rather than a flat +1 (§7.2).
	SaveManager.data["crate_progress"] = int(SaveManager.data["crate_progress"]) + _last_clear_gain
	SaveManager.save_game()
	_hud.disable_crate2x()
	AudioManager.play_sfx(&"crate_open")

func _on_crate_2x_fail() -> void:
	_crate2x_used = false  # allow retry if the ad simply wasn't available

## Auto-pause + persist when the app loses focus (§8.2 / §8.3): never die to a
## phone call, and never lose progress on a kill.
func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		SaveManager.save_game()
		_holding = false
		if _state == State.PLAY:
			_pause()

# --- Pause (§8.2, §10) ------------------------------------------------------

func _on_pause_pressed() -> void:
	if _state == State.PLAY:
		_pause()

func _pause() -> void:
	if get_tree().paused:
		return
	_holding = false
	get_tree().paused = true
	_hud.show_pause()

func _resume() -> void:
	get_tree().paused = false
	_hud.hide_pause()

func _on_restart() -> void:
	get_tree().paused = false
	Engine.time_scale = 1.0
	_refund_boosters(true)  # B6: restart refunds unused shield + slow-mo
	_goto_game()  # reloads the current level (no advance)

## Android back gesture (§8.5): pause during play, resume if already paused.
func on_back_requested() -> void:
	if get_tree().paused:
		_resume()
	elif _state == State.PLAY:
		_pause()

# --- Helpers ----------------------------------------------------------------

func _platform_y(i: int) -> float:
	return -float(i) * PLATFORM_GAP

func _finish_y() -> float:
	return _platform_y(_platform_count - 1) - PLATFORM_GAP

func _segment_under(i: int) -> int:
	var local := wrapf(-_platform_rot[i], 0.0, TAU)
	return int(floor(local / _seg_angle)) % _segment_count
