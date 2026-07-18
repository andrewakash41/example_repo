class_name LevelLibrary
extends RefCounted
## Produces a LevelData for any level number (§5). Levels 1-50 follow an explicit
## authored difficulty curve; 51+ interpolate procedurally with a soft ceiling at
## L200 (§5.1). Every 10th level is a boss. Deterministic: level N is always the
## same. The 1-50 curve is encoded here rather than as 50 .tres files so the
## progression reads as one tunable function (logged in DECISIONS.md); to_dict()
## can dump any level to JSON for the tooling schema.

const THEME_COUNT := 5
const SOFT_CEIL_LEVEL := 200

static func get_level(level_number: int) -> LevelData:
	var d := LevelData.new()
	d.level_number = level_number
	d.seed_value = level_number
	d.is_boss = level_number % 10 == 0
	d.theme_id = ((level_number - 1) / 10) % THEME_COUNT

	if level_number <= 50:
		_author_curve(d, level_number)
	else:
		_procedural(d, level_number)

	if d.is_boss:
		_apply_boss(d)
	return d

## Explicit handcrafted curve for L1-50 (§5.3). t in [0,1] across the band.
static func _author_curve(d: LevelData, n: int) -> void:
	var t: float = clampf(float(n - 1) / 49.0, 0.0, 1.0)

	d.platform_count = int(round(lerpf(25.0, 60.0, t)))
	d.segment_count = 8 if n < 25 else 10
	d.phase_duration = lerpf(2.5, 1.6, t)
	d.fever_threshold = 10 if n < 30 else 12   # §4: harder to earn Fever late
	d.gap_pct = 0.10

	# Obsidian: none L1-2, sparse (<=8%) through L10, then ramp to 0.28 by L50.
	if n <= 2:
		d.obsidian_pct = 0.0
	elif n <= 10:
		d.obsidian_pct = lerpf(0.02, 0.08, float(n - 3) / 7.0)
	else:
		d.obsidian_pct = lerpf(0.08, 0.28, float(n - 10) / 40.0)
	d.obsidian_pct = minf(d.obsidian_pct, 0.35)

	d.opposite_pct = lerpf(0.15, 0.40, t)

	# Rotation magnitude ramps; direction alternates every ~4 levels.
	var mag := lerpf(20.0, 75.0, t)
	var dir_sign := 1.0 if (n / 4) % 2 == 0 else -1.0
	d.rotation_speed_deg = mag * dir_sign

## Procedural 51+: keep interpolating toward the ceiling, then plateau (§5.1).
static func _procedural(d: LevelData, n: int) -> void:
	var t: float = clampf(float(n - 50) / float(SOFT_CEIL_LEVEL - 50), 0.0, 1.0)
	d.platform_count = int(round(lerpf(60.0, 80.0, t)))
	d.segment_count = 10
	d.phase_duration = lerpf(1.6, 1.4, t)
	d.fever_threshold = 12
	d.gap_pct = 0.10
	d.obsidian_pct = minf(lerpf(0.28, 0.32, t), 0.35)
	d.opposite_pct = lerpf(0.40, 0.44, t)
	var mag := lerpf(75.0, 90.0, t)
	var dir_sign := 1.0 if (n / 4) % 2 == 0 else -1.0
	d.rotation_speed_deg = mag * dir_sign

static func _apply_boss(d: LevelData) -> void:
	d.platform_count = int(round(d.platform_count * 1.5))
	d.rotation_variance = 1.15   # second band spins 1.15x, opposite direction
	# Bosses guarantee a crate on clear (handled at clear time) and get a darker
	# grade (theme handled in P3).
