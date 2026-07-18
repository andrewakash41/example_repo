class_name LevelData
extends Resource
## The level schema the tower generator consumes (§5.2). A plain Resource so it
## can be authored in .tres, exported to JSON for tooling, or produced on the
## fly by LevelLibrary (curve for 1-50, procedural 51+). Seeded by level number
## so every player gets identical level N (§5.1).

@export var level_number: int = 1
@export var platform_count: int = 25          # 25 (L1) -> 60 (L50); boss x1.5
@export var segment_count: int = 8            # 8, or 10 from L25+
@export var rotation_speed_deg: float = 20.0  # magnitude+sign; sign alternates
@export var rotation_variance: float = 0.0    # boss only: per-band multiplier
@export var phase_duration: float = 2.5       # 2.5 -> 1.6
@export var obsidian_pct: float = 0.0         # 0 -> 0.28, hard cap 0.35
@export var opposite_pct: float = 0.15        # 0.15 -> 0.40 (drives color runs)
@export var gap_pct: float = 0.10             # ~constant
@export var theme_id: int = 0                 # visual theme, cycles every 10
@export var is_boss: bool = false

## Deterministic seed. Defaults to level number; set explicitly for tests.
@export var seed_value: int = 1

## opposite_pct is authored as a difficulty target; the generator turns it into
## a color run-persistence probability (longer single-color stretches force the
## player to wait for phase flips). Mapping kept here so it's one place to tune.
func color_run_bias() -> float:
	return clampf(0.5 + (opposite_pct - 0.15) * 1.6, 0.5, 0.92)

## Exports the schema as a plain Dictionary (JSON-friendly, for tooling §5.2).
func to_dict() -> Dictionary:
	return {
		"level_number": level_number,
		"platform_count": platform_count,
		"segment_count": segment_count,
		"rotation_speed_deg": rotation_speed_deg,
		"rotation_variance": rotation_variance,
		"phase_duration": phase_duration,
		"obsidian_pct": obsidian_pct,
		"opposite_pct": opposite_pct,
		"gap_pct": gap_pct,
		"theme_id": theme_id,
		"is_boss": is_boss,
	}
