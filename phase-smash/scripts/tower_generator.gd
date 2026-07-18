class_name TowerGenerator
extends RefCounted
## Builds and validates the segment-state model for a tower from a LevelData.
## Emits PSTypes.Seg values. Deterministic for a given seed. Guarantees every
## platform is winnable: at least 2 circularly-contiguous "safe" segments (gap
## or matching color) exist for EACH phase, so the rotating tower always offers
## a descent window in whatever phase the ball is in (§5.2). Invalid platforms
## are rerolled, then force-fixed as a last resort.

const MAX_REROLLS := 16

## Returns Array[Array[int]] — platforms[i][s] is a PSTypes.Seg value.
static func build(level: LevelData) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = level.seed_value
	var run_bias := level.color_run_bias()
	var platforms: Array = []
	for i in level.platform_count:
		var p := _gen_platform(rng, level.segment_count, level.gap_pct, level.obsidian_pct, run_bias)
		var attempts := 0
		while not is_platform_valid(p, level.segment_count) and attempts < MAX_REROLLS:
			p = _gen_platform(rng, level.segment_count, level.gap_pct, level.obsidian_pct, run_bias)
			attempts += 1
		if not is_platform_valid(p, level.segment_count):
			_force_fix(p)
		platforms.append(p)
	return platforms

static func _gen_platform(rng: RandomNumberGenerator, n: int, gap_pct: float, obs_pct: float, run_bias: float) -> Array:
	var segs: Array[int] = []
	var prev_color := -1
	for s in n:
		var r := rng.randf()
		if r < gap_pct:
			segs.append(PSTypes.Seg.GAP)
		elif r < gap_pct + obs_pct:
			segs.append(PSTypes.Seg.OBSIDIAN)
		else:
			var color: int
			if prev_color == -1 or rng.randf() > run_bias:
				color = PSTypes.Seg.AMBER if rng.randf() < 0.5 else PSTypes.Seg.AZURE
			else:
				color = prev_color  # extend the run (harder: forces waiting)
			segs.append(color)
			prev_color = color
	return segs

## Two adjacent gaps satisfy the safe-pair rule for both phases at once.
static func _force_fix(p: Array) -> void:
	p[0] = PSTypes.Seg.GAP
	p[1 % p.size()] = PSTypes.Seg.GAP

# --- Validation (pure, reused by tests) -------------------------------------

static func is_platform_valid(p: Array, n: int) -> bool:
	return _has_safe_pair(p, n, PSTypes.Seg.AMBER) and _has_safe_pair(p, n, PSTypes.Seg.AZURE)

static func _has_safe_pair(p: Array, n: int, match_color: int) -> bool:
	for i in n:
		if _safe(p[i], match_color) and _safe(p[(i + 1) % n], match_color):
			return true
	return false

static func _safe(seg: int, match_color: int) -> bool:
	return seg == PSTypes.Seg.GAP or seg == match_color
