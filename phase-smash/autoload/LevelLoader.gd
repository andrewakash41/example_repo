extends Node
## Resolves a level number to the parameters the tower generator consumes.
## P0: returns a simple greybox config (fixed platform count, gap-only variety,
## no phases). The handcrafted L1–50 resources + procedural 51+ land in P2 (§5).

## Minimal P0 level config. Mirrors a subset of the final schema (§5.2) so the
## generator's signature doesn't churn later.
class LevelConfig:
	var level_number: int = 1
	var platform_count: int = 30
	var segment_count: int = 8
	var gap_pct: float = 0.15
	var rotation_speed_deg: float = 30.0
	var seed_value: int = 1

func load_level(level_number: int) -> LevelConfig:
	var cfg := LevelConfig.new()
	cfg.level_number = level_number
	cfg.seed_value = level_number  # deterministic per level (§5.1)
	return cfg
