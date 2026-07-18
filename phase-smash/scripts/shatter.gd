class_name Shatter
extends Node3D
## A short-lived debris burst spawned when a segment breaks (§6.2: script-driven
## velocity + gravity, no physics bodies, ~0.8s lifetime, fade out). One node
## owns all its chunks and frees itself when they expire — nothing to pool yet
## in P0; pooling comes with the perf pass (§8.4).

const CHUNK_COUNT := 6
const LIFETIME := 0.8
const GRAVITY := 24.0

var _chunks: Array = []      # each: {node, vel, spin}
var _age := 0.0

## Convenience spawner: creates a burst at world `pos`, tinted `color`.
static func burst(parent: Node, pos: Vector3, color: Color) -> void:
	var b := Shatter.new()
	parent.add_child(b)
	b.global_position = pos
	b._emit(color)

func _emit(color: Color) -> void:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	for i in CHUNK_COUNT:
		var chunk := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		var s := rng.randf_range(0.12, 0.22)
		mesh.size = Vector3(s, s, s)
		chunk.mesh = mesh

		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = 1.5
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		chunk.material_override = mat

		add_child(chunk)
		_chunks.append({
			"node": chunk,
			"vel": Vector3(
				rng.randf_range(-2.0, 2.0),
				rng.randf_range(1.5, 4.0),
				rng.randf_range(-2.0, 2.0)),
			"spin": Vector3(
				rng.randf_range(-8, 8),
				rng.randf_range(-8, 8),
				rng.randf_range(-8, 8)),
		})

func _process(delta: float) -> void:
	_age += delta
	var t: float = clampf(_age / LIFETIME, 0.0, 1.0)
	for c in _chunks:
		var node: MeshInstance3D = c["node"]
		c["vel"].y -= GRAVITY * delta
		node.position += c["vel"] * delta
		node.rotation += c["spin"] * delta
		var mat := node.material_override as StandardMaterial3D
		if mat:
			mat.albedo_color.a = 1.0 - t
	if _age >= LIFETIME:
		queue_free()
