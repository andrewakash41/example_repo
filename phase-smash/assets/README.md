# assets/

Drop-in art and audio. Everything here is loaded lazily and the game runs
without it (silent audio, procedural visuals), so files can be added
incrementally.

## Audio (§6.5)

- `sfx/<id>.ogg` — one file per SFX id. Current ids:
  `shatter`, `phase_flip`, `hard_bounce`, `death`, `fever`, `level_clear`,
  `ui_tap`, `crate_open`.
- `music/<id>.ogg` — `menu`, `gameplay`, plus a `fever` intensity stem.

Source from **CC0 / CC-BY** (Kenney, FreePD, OpenGameArt); attribute CC-BY in
the credits screen. Keep total audio < 4 MB OGG. Normalize SFX levels.

## Textures / meshes

Currently all visuals are generated in code (emissive materials, procedural sky,
GPU particles with billboard quads). Pre-authored halo/shatter textures for the
"fake bloom" path (§6.2) and any skin textures go under `textures/` and
`materials/`.
