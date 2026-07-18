class_name HarnessBot
extends RefCounted
## Headless playtest bot (§8.6). Simulates the ball + phase system without a
## scene tree, running a simple policy with configurable reaction latency, and
## reports per-level difficulty (clear rate, avg attempts, avg duration, death
## causes). This substitutes for playtesting at scale — Opus tunes level data
## against these reports until the §5.3 curve targets hold.
##
## The physics/interaction here mirror game.gd. Shared constants come from
## SimParams (C1) so the bot cannot drift from the live game.

const DT := 1.0 / 60.0
# Physics constants come from SimParams (C1) so the bot can never drift from the
# live game — its whole value is being a faithful stand-in for real play.
const PLATFORM_GAP := SimParams.PLATFORM_GAP
const PLATFORM_THICKNESS := SimParams.PLATFORM_THICKNESS
const BALL_RADIUS := SimParams.BALL_RADIUS
const SMASH_ACCEL := SimParams.SMASH_ACCEL
const SMASH_TERMINAL := SimParams.SMASH_TERMINAL
const GRAVITY_IDLE := SimParams.GRAVITY_IDLE
const IDLE_BOUNCE_HEIGHT := SimParams.IDLE_BOUNCE_HEIGHT
const HARD_BOUNCE_GAPS := SimParams.HARD_BOUNCE_GAPS
const START_DROP_GAPS := SimParams.START_DROP_GAPS
const INPUT_LOCK := SimParams.INPUT_LOCK
const BOSS_BAND_SIZE := SimParams.BOSS_BAND_SIZE
const TIMEOUT_S := 90.0

## Runs `runs` attempts and returns aggregate stats for one level.
static func simulate_level(level: LevelData, runs: int = 20, latency_s: float = 0.25) -> Dictionary:
	var clears := 0
	var total_time := 0.0
	var death_obsidian := 0
	var death_timeout := 0
	for r in runs:
		var rng := RandomNumberGenerator.new()
		rng.seed = level.seed_value * 1000 + r  # vary policy jitter per attempt
		var res := _play_once(level, rng, latency_s)
		if res["cleared"]:
			clears += 1
			total_time += res["duration"]
		elif res["cause"] == "obsidian":
			death_obsidian += 1
		else:
			death_timeout += 1
	var clear_rate := float(clears) / float(runs)
	return {
		"level": level.level_number,
		"is_boss": level.is_boss,
		"clear_rate": clear_rate,
		"avg_attempts": (1.0 / clear_rate) if clear_rate > 0.0 else INF,
		"avg_duration": (total_time / clears) if clears > 0 else 0.0,
		"death_obsidian": death_obsidian,
		"death_timeout": death_timeout,
	}

static func _play_once(level: LevelData, rng: RandomNumberGenerator, latency_s: float) -> Dictionary:
	var n := level.segment_count
	var seg_angle := TAU / float(n)
	var platforms := TowerGenerator.build(level)
	var broken := {}
	var base_speed := deg_to_rad(level.rotation_speed_deg)

	var rot := []
	var speed := []
	for i in level.platform_count:
		rot.append(0.0)
		speed.append(_band_speed(level, i, base_speed))

	var idle_v := sqrt(2.0 * GRAVITY_IDLE * IDLE_BOUNCE_HEIGHT)
	var hard_v := sqrt(2.0 * GRAVITY_IDLE * (HARD_BOUNCE_GAPS * PLATFORM_GAP))

	var ball_y := -0.0 + START_DROP_GAPS * PLATFORM_GAP
	var ball_vy := 0.0
	var phase := PSTypes.Phase.A
	var phase_timer := level.phase_duration
	var chain := 0
	var fever := false
	var fever_grace := 0.0
	var fever_threshold := level.fever_threshold  # per-level, matches game.gd (B9/B13)
	var input_lock := 0.0
	var decide_cd := 0.0
	var holding := false
	var t := 0.0
	var finish_y := -float(level.platform_count - 1) * PLATFORM_GAP - PLATFORM_GAP

	while t < TIMEOUT_S:
		t += DT
		for i in level.platform_count:
			rot[i] += speed[i] * DT

		# Policy: refresh decision every latency window (with small jitter).
		decide_cd -= DT
		if decide_cd <= 0.0:
			decide_cd = latency_s * rng.randf_range(0.85, 1.15)
			holding = _want_smash(platforms, broken, rot, n, seg_angle, ball_y, phase, phase_timer, level, fever)

		input_lock = maxf(input_lock - DT, 0.0)
		var eff_hold: bool = holding and input_lock <= 0.0

		# Phase timer (paused while smash-descending).
		if not (eff_hold and ball_vy < 0.0):
			phase_timer -= DT
			if phase_timer <= 0.0:
				phase = PSTypes.other_phase(phase)
				phase_timer = level.phase_duration
		# Fever grace.
		if fever:
			if eff_hold:
				fever_grace = SimParams.FEVER_GRACE
			else:
				fever_grace -= DT
				if fever_grace <= 0.0:
					fever = false

		var prev_bottom := ball_y - BALL_RADIUS
		if eff_hold:
			ball_vy = maxf(ball_vy - SMASH_ACCEL * DT, -SMASH_TERMINAL)
		else:
			ball_vy -= GRAVITY_IDLE * DT
		ball_y += ball_vy * DT
		var new_bottom := ball_y - BALL_RADIUS

		if ball_vy < 0.0:
			for i in level.platform_count:
				var y_top := -float(i) * PLATFORM_GAP + PLATFORM_THICKNESS * 0.5
				if not (prev_bottom > y_top and new_bottom <= y_top):
					continue
				var s := _seg_under(rot[i], seg_angle, n)
				var key := i * 100 + s
				var kind: int = platforms[i][s]
				if kind == PSTypes.Seg.GAP or broken.has(key):
					continue
				if not eff_hold:
					ball_y = y_top + BALL_RADIUS
					ball_vy = idle_v
					break
				if fever:
					# Fever: every segment shatters; refresh grace so the chain
					# keeps the run in Fever (the old `if chain >= FEVER_THRESHOLD:
					# fever = true` here was a no-op — fever is already true) (B13).
					broken[key] = true; chain += 1
					fever_grace = SimParams.FEVER_GRACE
					continue
				if kind == PSTypes.Seg.OBSIDIAN:
					return {"cleared": false, "cause": "obsidian", "duration": t}
				if PSTypes.is_matching(kind, phase):
					broken[key] = true; chain += 1
					if not fever and chain >= fever_threshold:
						fever = true; fever_grace = SimParams.FEVER_GRACE
					continue
				# opposite -> hard bounce
				ball_y = y_top + BALL_RADIUS
				ball_vy = hard_v
				chain = 0
				input_lock = INPUT_LOCK
				break

		if ball_y - BALL_RADIUS <= finish_y + 0.3:
			return {"cleared": true, "cause": "", "duration": t}

	return {"cleared": false, "cause": "timeout", "duration": t}

## Policy: smash if the next platform's segment under the ball is safe now, or
## will be safe by the time we reach it after a phase flip; otherwise wait.
static func _want_smash(platforms: Array, broken: Dictionary, rot: Array, n: int,
		seg_angle: float, ball_y: float, phase: int, phase_timer: float,
		level: LevelData, fever: bool) -> bool:
	if fever:
		return true
	var ball_bottom := ball_y - BALL_RADIUS
	# First platform strictly below the ball.
	for i in level.platform_count:
		var y_top := -float(i) * PLATFORM_GAP + PLATFORM_THICKNESS * 0.5
		if y_top >= ball_bottom:
			continue
		var s := _seg_under(rot[i], seg_angle, n)
		var key := i * 100 + s
		var kind: int = platforms[i][s]
		if kind == PSTypes.Seg.GAP or broken.has(key):
			return true  # empty column — safe to dive
		if kind == PSTypes.Seg.OBSIDIAN:
			return false
		if PSTypes.is_matching(kind, phase):
			return true
		# opposite: dive only if a flip is imminent (would flip to matching)
		return phase_timer < 0.18
	return true

static func _band_speed(level: LevelData, i: int, base_speed: float) -> float:
	if not level.is_boss or level.rotation_variance == 0.0:
		return base_speed
	var band := (i / BOSS_BAND_SIZE) % 2
	return base_speed if band == 0 else -base_speed * level.rotation_variance

static func _seg_under(platform_rot: float, seg_angle: float, n: int) -> int:
	return int(floor(wrapf(-platform_rot, 0.0, TAU) / seg_angle)) % n
