class_name ShatterPool
extends Node3D
## Pooled debris bursts (§6.2, §8.4). A segment break spawns ~6 script-driven
## chunks (velocity + gravity, no physics bodies, ~0.8s fade). Fever chains fire
## ~10 bursts/second, so instead of allocating 6 meshes + 6 materials per burst
## (the P0 approach, B3) this owns a fixed pool of chunk nodes that share ONE
## BoxMesh and each keep their OWN reusable material — so alpha fades stay
## independent while steady-state allocation is zero.

const CHUNK_COUNT := 6
const LIFETIME := 0.8
const GRAVITY := 24.0
const POOL_BURSTS := 14          # ~10 bursts/s * 0.8s lifetime, with headroom
const CHUNK_SIZE := 0.17

var _shared_mesh: BoxMesh
var _chunks: Array = []           # each: {node, mat, vel, spin, age, active}
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	_rng.randomize()
	_shared_mesh = BoxMesh.new()
	_shared_mesh.size = Vector3(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE)
	for i in POOL_BURSTS * CHUNK_COUNT:
		_chunks.append(_make_chunk())

func _make_chunk() -> Dictionary:
	var node := MeshInstance3D.new()
	node.mesh = _shared_mesh
	node.visible = false
	# One material per pooled chunk, reused forever — only its color/alpha change.
	var mat := StandardMaterial3D.new()
	mat.emission_enabled = true
	mat.emission_energy_multiplier = 1.5
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	node.material_override = mat
	add_child(node)
	return {"node": node, "mat": mat, "vel": Vector3.ZERO,
		"spin": Vector3.ZERO, "age": 0.0, "active": false}

## Spawn a burst at world `pos`, tinted `color`. Reuses idle pooled chunks; if the
## pool is momentarily exhausted the burst is simply smaller (never allocates).
func burst(pos: Vector3, color: Color) -> void:
	var spawned := 0
	for c in _chunks:
		if spawned >= CHUNK_COUNT:
			break
		if c["active"]:
			continue
		_launch(c, pos, color)
		spawned += 1

func _launch(c: Dictionary, pos: Vector3, color: Color) -> void:
	var node: MeshInstance3D = c["node"]
	node.position = pos
	node.rotation = Vector3.ZERO
	var s := _rng.randf_range(0.7, 1.3)
	node.scale = Vector3(s, s, s)
	node.visible = true
	var mat: StandardMaterial3D = c["mat"]
	mat.albedo_color = color
	mat.emission = color
	c["vel"] = Vector3(
		_rng.randf_range(-2.0, 2.0),
		_rng.randf_range(1.5, 4.0),
		_rng.randf_range(-2.0, 2.0))
	c["spin"] = Vector3(
		_rng.randf_range(-8, 8),
		_rng.randf_range(-8, 8),
		_rng.randf_range(-8, 8))
	c["age"] = 0.0
	c["active"] = true

func _process(delta: float) -> void:
	for c in _chunks:
		if not c["active"]:
			continue
		c["age"] += delta
		var t: float = clampf(c["age"] / LIFETIME, 0.0, 1.0)
		var node: MeshInstance3D = c["node"]
		c["vel"].y -= GRAVITY * delta
		node.position += c["vel"] * delta
		node.rotation += c["spin"] * delta
		var mat: StandardMaterial3D = c["mat"]
		mat.albedo_color.a = 1.0 - t
		if c["age"] >= LIFETIME:
			c["active"] = false
			node.visible = false
