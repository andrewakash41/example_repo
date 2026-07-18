class_name TowerGenerator
extends RefCounted
## Builds the data model for a tower: a list of platforms, each an array of
## segment states. P0 greybox knows only two states — SOLID and GAP (no phase
## colors, no obsidian). Phase A/B + obsidian + the winnability validator arrive
## in P1/P2 (§3.3, §5.2). Kept static + deterministic (seeded) so tests and the
## harness bot get identical towers for a given seed.

enum Seg { GAP, SOLID }

## Returns Array[Array[int]] — platforms[i] is an array of Seg values of length
## segment_count. Platform i sits lower than platform i-1 (see Game layout).
static func generate(platform_count: int, segment_count: int, gap_pct: float, seed_value: int) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var platforms: Array = []
	for i in platform_count:
		var segs: Array[int] = []
		var solid_count := 0
		for s in segment_count:
			if rng.randf() < gap_pct:
				segs.append(Seg.GAP)
			else:
				segs.append(Seg.SOLID)
				solid_count += 1
		# Greybox safety: never emit an all-gap platform (nothing to bounce on).
		if solid_count == 0:
			segs[rng.randi_range(0, segment_count - 1)] = Seg.SOLID
		platforms.append(segs)
	return platforms
