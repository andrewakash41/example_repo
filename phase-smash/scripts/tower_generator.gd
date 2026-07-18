class_name TowerGenerator
extends RefCounted
## Builds the segment-state data model for a tower. Emits PSTypes.Seg values
## (GAP / AMBER / AZURE / OBSIDIAN). Deterministic for a given seed so tests and
## the harness bot get identical towers. The winnability validator lands in P2.

## Composition knobs come from the level config (§5.2). For P1 the level is
## authored lightly; full curve + validator are P2.
## Returns Array[Array[int]] — platforms[i][s] is a PSTypes.Seg value.
static func generate(
		platform_count: int,
		segment_count: int,
		gap_pct: float,
		obsidian_pct: float,
		color_bias: float,          # 0.5 = even amber/azure; drift adds same-color runs
		seed_value: int) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var platforms: Array = []
	for i in platform_count:
		platforms.append(_build_platform(rng, segment_count, gap_pct, obsidian_pct, color_bias))
	return platforms

static func _build_platform(
		rng: RandomNumberGenerator,
		segment_count: int,
		gap_pct: float,
		obsidian_pct: float,
		color_bias: float) -> Array:
	var segs: Array[int] = []
	var colored := 0
	for s in segment_count:
		var r := rng.randf()
		if r < gap_pct:
			segs.append(PSTypes.Seg.GAP)
		elif r < gap_pct + obsidian_pct:
			segs.append(PSTypes.Seg.OBSIDIAN)
		else:
			# Colored: bias toward amber/azure to create runs the player must
			# wait out. color_bias is the amber probability for this slot.
			if rng.randf() < color_bias:
				segs.append(PSTypes.Seg.AMBER)
			else:
				segs.append(PSTypes.Seg.AZURE)
			colored += 1
	# Safety: never emit a platform with no colored segment to land/smash on.
	if colored == 0:
		segs[rng.randi_range(0, segment_count - 1)] = (
			PSTypes.Seg.AMBER if rng.randf() < 0.5 else PSTypes.Seg.AZURE)
	return segs
