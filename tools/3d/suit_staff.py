"""Build a Kaelis Labs staff member in protective gear (no face, no skin): a loose suit that really hangs on a body.

Run (headless), once per character:
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/suit_staff.py -- <assayer|archivist|broker|smith> [preview_dir]

Output: site/models/staff-<name>.raw.glb (compress with `gltf-transform meshopt` into staff-<name>.glb). One mesh,
plain materials (no textures), ambient occlusion baked into the vertex colours.

How: the body is a union of simple masses (voxel remesh). The suit is the same body, a little larger and with
extra fabric, simulated as cloth that settles on the body under gravity, so the folds at the elbows, waist and
knees are real. Helmet glass, gloves, boots and fittings are hard parts added after.
Conventions: 1 unit = 1 m, floor z = 0, faces Blender +Y (glTF -Z).
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = ARGS[0] if ARGS else "assayer"
PREVIEW = ARGS[1] if len(ARGS) > 1 else None
FRAMES = 45
OUT = os.path.join(ROOT, "site", "models", "staff-%s.raw.glb" % NAME)
# g = girth of the body, slack = how much larger the suit is, head = what covers the face
VARIANTS = {
    "assayer":   dict(g=1.0,  slack=1.22, head="dome",    suit=(0.86, 0.87, 0.88), rough=0.42, accent=(0.1, 0.78, 0.62), glove=(0.08, 0.3, 0.26),   bend=0.6),   # full hazmat, blower on the back
    "archivist": dict(g=0.92, slack=1.13, head="goggles", suit=(0.62, 0.74, 0.86), rough=0.55, accent=(1.0, 0.6, 0.15),  glove=(0.8, 0.82, 0.85),   bend=0.25),  # slim cleanroom suit, goggles and mask, clipboard
    "broker":    dict(g=1.0,  slack=1.12, head="bubble",  suit=(0.05, 0.065, 0.1), rough=0.6,  accent=(0.3, 0.65, 1.0),  glove=(0.8, 0.82, 0.85),   bend=0.4),   # dark suit, collar and tie, clear bubble helmet
    "smith":     dict(g=1.2,  slack=1.2,  head="weld",    suit=(0.33, 0.2, 0.11),  rough=0.75, accent=(1.0, 0.4, 0.1),   glove=(0.05, 0.05, 0.055), bend=1.2),   # broad, heavy coat, welding helmet, tool belt
}
V = VARIANTS[NAME]
G = V["g"]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, FRAMES
D = bpy.data.objects


def mat(name, col, rough=0.5, metal=0.0, emit=None, strength=0.0, trans=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = trans
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def sphere(loc, scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=loc)
    o = bpy.context.object
    o.scale = scale if hasattr(scale, "__len__") else (scale,) * 3
    return o


def limb(a, b, ra, rb=None):
    """A tapered capsule from a to b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=ra, radius2=rb or ra, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return [o, sphere(a, ra), sphere(b, rb or ra)]


def body_parts(k=1.0):
    """The figure, standing, arms a little out and forward. k scales the girth (suit = body made larger)."""
    P = []
    P.append(sphere((0, 0, 1.63), (0.105 * k, 0.12 * k, 0.13 * k)))            # head
    P += limb((0, 0, 1.5), (0, 0, 1.42), 0.06 * k)                              # neck
    P.append(sphere((0, 0, 1.28), (0.185 * k, 0.125 * k, 0.17 * k)))           # chest
    P.append(sphere((0, 0.01, 1.08), (0.165 * k, 0.12 * k, 0.15 * k)))         # belly
    P.append(sphere((0, 0, 0.95), (0.175 * k, 0.13 * k, 0.13 * k)))            # hips
    for s in (-1, 1):
        P += limb((s * 0.2, 0, 1.4), (s * 0.3, 0.03, 1.14), 0.062 * k, 0.052 * k)        # upper arm
        P += limb((s * 0.3, 0.03, 1.14), (s * 0.31, 0.16, 0.9), 0.05 * k, 0.04 * k)      # forearm
        P += limb((s * 0.1, 0, 0.9), (s * 0.115, 0.02, 0.5), 0.092 * k, 0.065 * k)       # thigh
        P += limb((s * 0.115, 0.02, 0.5), (s * 0.115, 0, 0.1), 0.062 * k, 0.045 * k)     # shin
    return P


def union(parts, name, voxel):
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    rm = o.modifiers.new("remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier="remesh")
    sm = o.modifiers.new("smooth", "SMOOTH")
    sm.iterations = 12
    sm.factor = 0.6
    bpy.ops.object.modifier_apply(modifier="smooth")
    return o


# ---- the body the suit hangs on
body = union(body_parts(G), "Body", 0.02)
body.modifiers.new("collision", "COLLISION")
body.collision.use = True
body.collision.thickness_outer = 0.006
body.collision.cloth_friction = 25

# ---- the suit: the same shape, larger, with a hood; simulated so it settles into real folds
parts = body_parts(G * V["slack"])
parts.append(sphere((0, -0.01, 1.64), (0.15, 0.165, 0.17)))                    # hood
suit = union(parts, "Suit", 0.016)
cloth = suit.modifiers.new("cloth", "CLOTH")
cs = cloth.settings
cs.quality = 8
cs.mass = 0.25
cs.tension_stiffness = cs.compression_stiffness = 12
cs.shear_stiffness = 8
cs.bending_stiffness = V["bend"]     # stiffer fabric = bigger, fewer folds
cs.shrink_min = -0.05                # 5 % more fabric than the surface it starts on
cs.air_damping = 3
cc = cloth.collision_settings
cc.use_collision = True
cc.distance_min = 0.006
cc.use_self_collision = True
cc.self_distance_min = 0.004
cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, FRAMES
for f in range(1, FRAMES + 1):
    scene.frame_set(f)
dg = bpy.context.evaluated_depsgraph_get()
draped = bpy.data.meshes.new_from_object(suit.evaluated_get(dg))
suit.modifiers.clear()
suit.data = draped
bpy.ops.object.select_all(action="DESELECT")
suit.select_set(True)
bpy.context.view_layer.objects.active = suit
sub = suit.modifiers.new("sub", "SUBSURF")
sub.levels = 1
bpy.ops.object.modifier_apply(modifier="sub")
bpy.ops.object.shade_smooth()
zs = [v.co.z for v in suit.data.vertices]
print("SUIT %s verts=%d z=%.2f..%.2f" % (NAME, len(suit.data.vertices), min(zs), max(zs)))

M = dict(
    suit=mat("suit", V["suit"], V["rough"]), glass=mat("glass", (0.02, 0.03, 0.035), 0.04, 0.9),
    rubber=mat("rubber", V["glove"], 0.45), dark=mat("dark", (0.03, 0.03, 0.035), 0.45),
    steel=mat("steel", (0.62, 0.63, 0.65), 0.28, 1.0), mint=mat("accent", V["accent"], 0.4),
    white=mat("white", (0.9, 0.9, 0.9), 0.3), led=mat("led", (0, 0, 0), 0.4, emit=V["accent"], strength=6),
    green=mat("weldglass", (0.01, 0.06, 0.03), 0.05, 0.9), paper=mat("paper", (0.95, 0.95, 0.92), 0.7), board=mat("board", (0.3, 0.22, 0.15), 0.6), navy=mat("tie", (0.04, 0.08, 0.2), 0.5),
)
suit.data.materials.append(M["suit"])
body.data.materials.append(M["dark"])


def add(o, m, name, smooth=True, bevel=0.0):
    o.name = name
    o.data.materials.append(M[m])
    bpy.context.view_layer.objects.active = o
    if bevel:
        md = o.modifiers.new("b", "BEVEL")
        md.width = bevel
        md.segments = 3
    if smooth:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.ops.object.shade_smooth()
    return o


def box(size, loc, m, name, rot=(0, 0, 0), bevel=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return add(o, m, name, smooth=False, bevel=bevel)


def cyl(r, h, loc, m, name, rot=(0, 0, 0), v=28):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=v)
    return add(bpy.context.object, m, name)


def torus(R, r, loc, m, name, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot)
    return add(bpy.context.object, m, name)


# ---- hard parts
CY = 0.176 * G  # how far the chest stands out
if V["head"] == "dome":
    # helmet glass: a wide dark visor set into the hood, with a frame
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0.035, 1.645))
    v = bpy.context.object
    v.scale = (0.135, 0.15, 0.125)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(v.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y < 0.1 or abs(f.calc_center_median().z - 1.645) > 0.085], context="FACES")
    bm.to_mesh(v.data)
    bm.free()
    sol = v.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.008
    add(v, "glass", "Visor")
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0.03, 1.645))
    fr = bpy.context.object
    fr.scale = (0.142, 0.152, 0.135)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(fr.data)
    keep = lambda c: c.y >= 0.085 and abs(c.z - 1.645) <= 0.105
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median()) or (f.calc_center_median().y >= 0.104 and abs(f.calc_center_median().z - 1.645) <= 0.08)], context="FACES")
    bm.to_mesh(fr.data)
    bm.free()
    sol = fr.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.014
    add(fr, "white", "VisorFrame")
    # breathing: two filter canisters low on the hood, a blower unit on the back with a hose
    for s in (-1, 1):
        cyl(0.038, 0.05, (s * 0.085, 0.125, 1.535), "white", "Filter%d" % (s > 0), rot=(math.pi / 2 - 0.5, 0, s * 0.6))
        cyl(0.03, 0.012, (s * 0.098, 0.146, 1.523), "mint", "FilterCap%d" % (s > 0), rot=(math.pi / 2 - 0.5, 0, s * 0.6))
    box((0.24, 0.1, 0.3), (0, -0.2, 1.2), "white", "Blower", bevel=0.02)
    box((0.16, 0.012, 0.05), (0, -0.253, 1.28), "dark", "BlowerGrille", bevel=0.003)
    box((0.03, 0.01, 0.012), (0.07, -0.253, 1.12), "led", "BlowerLed", bevel=0.002)
    for i in range(9):
        t = i / 8
        torus(0.022, 0.008, (0.09 - t * 0.03, -0.2 + t * 0.07, 1.36 + t * 0.19), "dark", "Hose%d" % i, rot=(0.9 - t * 0.6, 0, 0))
elif V["head"] == "goggles":   # cleanroom: a goggle band and a mask, the hood stays
    box((0.2, 0.03, 0.062), (0, 0.142, 1.665), "dark", "GoggleFrame", bevel=0.02)
    box((0.17, 0.02, 0.04), (0, 0.158, 1.665), "glass", "GoggleLens", bevel=0.012)
    torus(0.132, 0.012, (0, -0.01, 1.665), "dark", "GoggleStrap")
    box((0.13, 0.07, 0.09), (0, 0.118, 1.585), "white", "Mask", bevel=0.03)
    for s_ in (-1, 1):
        box((0.01, 0.1, 0.008), (s_ * 0.07, 0.07, 1.6), "white", "MaskBand%d" % (s_ > 0), bevel=0.002)
    box((0.21, 0.012, 0.29), (0.2, 0.26, 0.98), "board", "Clipboard", rot=(-0.9, 0, 0.2), bevel=0.004)
    box((0.18, 0.004, 0.25), (0.2, 0.268, 0.988), "paper", "Paper", rot=(-0.9, 0, 0.2), bevel=0.0)
    box((0.07, 0.016, 0.02), (0.176, 0.345, 1.085), "steel", "ClipboardClip", rot=(-0.9, 0, 0.2), bevel=0.004)
elif V["head"] == "bubble":    # a clear, reflective bubble on a steel collar; under it a collar and tie
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0.01, 1.66))
    b_ = bpy.context.object
    b_.scale = (0.185, 0.195, 0.195)
    bpy.ops.object.transform_apply(scale=True)
    add(b_, "glass", "Bubble")
    torus(0.15, 0.022, (0, 0.0, 1.5), "steel", "Collar")
    torus(0.15, 0.008, (0, 0.0, 1.527), "mint", "CollarLine")
    box((0.17, 0.02, 0.06), (0, CY - 0.012, 1.42), "white", "ShirtCollar", rot=(0.25, 0, 0), bevel=0.008)
    box((0.05, 0.012, 0.045), (0, CY + 0.004, 1.385), "navy", "TieKnot", rot=(0.2, 0, 0), bevel=0.006)
    box((0.055, 0.01, 0.3), (0, CY + 0.006, 1.22), "navy", "Tie", rot=(0.06, 0, 0), bevel=0.004)
    box((0.02, 0.012, 0.012), (0.1, CY + 0.01, 1.33), "led", "Pin", bevel=0.003)
elif V["head"] == "weld":      # welding helmet with a small dark window, a tool belt
    box((0.25, 0.22, 0.31), (0, 0.05, 1.645), "dark", "WeldShell", bevel=0.07)
    box((0.13, 0.016, 0.06), (0, 0.158, 1.675), "steel", "WeldFrame", bevel=0.006)
    box((0.11, 0.016, 0.042), (0, 0.162, 1.675), "green", "WeldGlass", bevel=0.004)
    box((0.26, 0.05, 0.03), (0, 0.0, 1.77), "mint", "WeldBand", bevel=0.01)
    for s_ in (-1, 1):
        cyl(0.03, 0.02, (s_ * 0.128, 0.03, 1.66), "steel", "WeldPivot%d" % (s_ > 0), rot=(0, math.pi / 2, 0))
    torus(0.225, 0.022, (0, 0.0, 1.0), "dark", "Belt")
    box((0.1, 0.05, 0.13), (0.16, CY - 0.03, 0.95), "board", "Pouch", bevel=0.012)
    box((0.03, 0.03, 0.2), (-0.17, CY - 0.02, 0.9), "steel", "HammerHandle", bevel=0.008)
    box((0.09, 0.04, 0.045), (-0.17, CY - 0.02, 1.01), "steel", "HammerHead", bevel=0.008)
# gloves and boots, taped at the cuffs
for s in (-1, 1):
    # a gloved hand: palm, four fingers a little curled, a thumb (all hang from the wrist, tilted forward)
    rx, pc = -0.5, Vector((s * 0.315, 0.2, 0.845))
    def hang(dx, dy, dz):
        return (pc.x + dx, pc.y + dy * math.cos(rx) - dz * math.sin(rx), pc.z + dy * math.sin(rx) + dz * math.cos(rx))
    box((0.04, 0.09, 0.1), tuple(pc), "rubber", "Palm%d" % (s > 0), rot=(rx, 0, 0), bevel=0.016)
    for i, dy in enumerate((-0.033, -0.011, 0.011, 0.033)):
        ln = 0.07 - abs(i - 1.4) * 0.008
        cyl(0.0125, ln, hang(-s * 0.006, dy, -0.05 - ln / 2), "rubber", "Finger%d_%d" % (s > 0, i), rot=(rx + 0.25, 0, 0), v=12)
        sphere(hang(-s * 0.01, dy, -0.05 - ln), 0.0125).name = "Tip%d_%d" % (s > 0, i)
        bpy.context.object.data.materials.append(M["rubber"])
    cyl(0.014, 0.055, hang(-s * 0.03, 0.05, -0.01), "rubber", "Thumb%d" % (s > 0), rot=(rx + 0.5, s * 0.5, 0), v=12)
    cu = cyl(0.048, 0.09, (s * 0.311, 0.165, 0.895), "rubber", "GloveCuff%d" % (s > 0), rot=(-0.5, 0, 0))
    torus(0.05, 0.007, (s * 0.31, 0.15, 0.92), "mint", "CuffTape%d" % (s > 0), rot=(-0.5, 0, 0))
    box((0.108, 0.28, 0.034), (s * 0.115, 0.055, 0.017), "dark", "Sole%d" % (s > 0), bevel=0.012)
    add(sphere((s * 0.115, 0.075, 0.06), (0.05, 0.115, 0.05)), "white", "BootToe%d" % (s > 0))
    add(sphere((s * 0.115, -0.005, 0.07), (0.056, 0.07, 0.07)), "white", "BootHeel%d" % (s > 0))
    cyl(0.062, 0.16, (s * 0.115, 0.0, 0.16), "white", "BootShaft%d" % (s > 0))
    torus(0.064, 0.008, (s * 0.115, 0.0, 0.245), "mint", "BootTape%d" % (s > 0))
# chest: zip, ID badge, a mint line
if V["head"] != "bubble":
    box((0.012, 0.012, 0.5), (0, CY, 1.2), "steel", "Zip", rot=(0.05, 0, 0), bevel=0.003)
    box((0.09, 0.008, 0.09), (0.1 * G, CY + 0.004, 1.12), "suit", "Pocket", rot=(0.02, 0, 0), bevel=0.004)
    box((0.094, 0.01, 0.022), (0.1 * G, CY + 0.007, 1.168), "suit", "PocketFlap", rot=(0.02, 0, 0), bevel=0.004)
box((0.07, 0.006, 0.1), (-0.1 * G, CY + 0.012, 1.3), "white", "Badge", rot=(0.12, 0, 0), bevel=0.004)
box((0.07, 0.007, 0.022), (-0.1 * G, CY + 0.015, 1.337), "mint", "BadgeBar", rot=(0.12, 0, 0), bevel=0.002)

# ---- one mesh, ambient occlusion in the vertex colours, export
body.hide_render = True
allp = [o for o in D if o.type == "MESH" and o is not body]
for o in allp:
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
bpy.ops.object.select_all(action="DESELECT")
for o in allp:
    o.select_set(True)
bpy.context.view_layer.objects.active = suit
bpy.ops.object.join()
fig = bpy.context.object
fig.name = "Staff"
scene.world = bpy.data.worlds.new("AO")
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
try:
    col = fig.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    fig.data.color_attributes.active_color = col
    fig.data.color_attributes.render_color_index = 0
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.bake(type="AO")
except Exception as e:
    print("AO bake skipped:", e)
bpy.ops.object.select_all(action="DESELECT")
fig.select_set(True)
bpy.context.view_layer.objects.active = fig
kw = dict(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT")
try:
    bpy.ops.export_scene.gltf(export_colors=True, **kw)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print("STAFF %s exported, %d verts" % (NAME, len(fig.data.vertices)))

if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.77, 0.8, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    bpy.context.object.data.materials.append(mat("floor", (0.6, 0.61, 0.62), 0.25))
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, -3, 3), rotation=(math.pi / 2, 0, 0))
    bpy.context.object.data.materials.append(mat("wall", (0.8, 0.81, 0.82), 0.6))
    for name, loc, energy, size in (("Key", (-1.5, 2.4, 3.0), 500, 2.0), ("Fill", (2.2, 1.6, 2.0), 180, 2.0), ("Top", (0, 0, 3.6), 300, 3.0)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy, ld.size = energy, size
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(lo)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "OPTIX"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -1.3
    scene.render.resolution_x, scene.render.resolution_y = 560, 800
    for tag, loc, aim in (("front", (0.9, 3.4, 1.3), (0, 0, 0.92)),):
        cd = bpy.data.cameras.new(tag)
        cd.lens = 50
        cam = bpy.data.objects.new(tag, cd)
        cam.location = loc
        cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(cam)
        scene.camera = cam
        scene.render.filepath = os.path.join(PREVIEW, "staff-%s-%s.png" % (NAME, tag))
        bpy.ops.render.render(write_still=True)
