extends Node
## Resolves a level number to its LevelData. Delegates to LevelLibrary (authored
## curve 1-50, procedural 51+, boss every 10th — §5). Kept as the single lookup
## point so a future switch to on-disk .tres resources is a one-file change.

func load_level(level_number: int) -> LevelData:
	return LevelLibrary.get_level(maxi(level_number, 1))
