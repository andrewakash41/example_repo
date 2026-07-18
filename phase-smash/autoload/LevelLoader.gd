extends Node
## Resolves a level number to the parameters the tower generator consumes.
## P1: a single tunable config with phases + light obsidian so one level is
## genuinely playable end-to-end. The handcrafted L1-50 curve + procedural 51+
## and boss towers are wired in P2 via LevelLibrary (§5).

## Config shape mirrors a subset of the final level schema (§5.2) so callers
## don't churn when P2 replaces the source with authored resources.
class LevelConfig:
	var level_number: int = 1
	var platform_count: int = 30
	var segment_count: int = 8
	var gap_pct: float = 0.12
	var obsidian_pct: float = 0.06
	var color_bias: float = 0.5
	var rotation_speed_deg: float = 30.0
	var phase_duration: float = 2.5
	var is_boss: bool = false
	var theme_id: int = 0
	var seed_value: int = 1

func load_level(level_number: int) -> LevelConfig:
	var cfg := LevelConfig.new()
	cfg.level_number = level_number
	cfg.seed_value = level_number  # deterministic per level (§5.1)
	# Gentle P1 tuning: no obsidian on the very first level.
	if level_number <= 1:
		cfg.obsidian_pct = 0.0
		cfg.phase_duration = 2.5
	return cfg
