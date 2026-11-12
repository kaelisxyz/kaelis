"""Build the Kaelis core and the hammer of light, export GLBs for site/models/, render previews.

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/kaelis_models.py -- <preview_dir>

Conventions: 1 unit = 1 m, Blender -Y = front (becomes glTF +Z, where the site expects Kaelis' eye).
Materials are plain Principled BSDF so they export cleanly to glTF.
"""
import bpy, math, os, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "site", "models")
HDRI = os.path.join(ROOT, "tools", "3d", "assets", "studio_small_09_1k.hdr")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = argv[0] if argv else os.path.join(ROOT, "tools", "3d", "previews")
os.makedirs(OUT, exist_ok=True); os.makedirs(PREVIEW, exist_ok=True)

MINT = (0.349, 0.906, 0.792)      # #59E7CA
EMBER = (0.910, 0.506, 0.314)     # #E88150


# ---------- helpers ----------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def bsdf_input(b, *names):
    for n in names:
        if n in b.inputs:
            return b.inputs[n]
    return None

def mat(name, color, metallic=0.0, rough=0.5, emit=None, emit_strength=1.0, transmission=0.0, ior=1.5, coat=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if emit:
        bsdf_input(b, "Emission Color", "Emission").default_value = (*emit, 1)
        bsdf_input(b, "Emission Strength").default_value = emit_strength
    if transmission:
        bsdf_input(b, "Transmission Weight", "Transmission").default_value = transmission
        bsdf_input(b, "IOR").default_value = ior
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
        if hasattr(m, "shadow_method"): m.shadow_method = "NONE"
    if coat:
        i = bsdf_input(b, "Coat Weight", "Clearcoat")
        if i: i.default_value = coat
    return m

def wear_map(m, lo, hi, metallic=1.0, seed=1, size=512):
    """Give a material real roughness variation: a tileable noise + smudge map packed as a glTF
    metallicRoughness texture (G = roughness, B = metallic). Exported with the GLB."""
    import numpy as np
    rng = np.random.default_rng(seed)
    def octave(n):
        g = rng.random((n, n)).astype(np.float32)
        g = np.kron(g, np.ones((size // n, size // n), np.float32))
        for _ in range(3):  # periodic box blur keeps it tileable
            g = (g + np.roll(g, 1, 0) + np.roll(g, -1, 0) + np.roll(g, 1, 1) + np.roll(g, -1, 1)) / 5
            r = max(1, size // n // 2)
            g = (g + np.roll(g, r, 0) + np.roll(g, -r, 0) + np.roll(g, r, 1) + np.roll(g, -r, 1)) / 5
        return g
    v = octave(4) * 0.45 + octave(16) * 0.3 + octave(64) * 0.17 + octave(256) * 0.08
    v = (v - v.min()) / (v.max() - v.min() + 1e-6)
    # sparse smudges (handled areas get glossier)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    for _ in range(14):
        cx, cy, rad = rng.random() * size, rng.random() * size, (0.04 + rng.random() * 0.1) * size
        dx = np.minimum(np.abs(xx - cx), size - np.abs(xx - cx)); dy = np.minimum(np.abs(yy - cy), size - np.abs(yy - cy))
        v -= 0.35 * np.exp(-(dx * dx + dy * dy) / (2 * rad * rad))
    v = np.clip(v, 0, 1)
    rough = lo + (hi - lo) * v
    px = np.zeros((size, size, 4), np.float32)
    px[..., 1] = rough; px[..., 2] = metallic; px[..., 3] = 1
    img = bpy.data.images.new(m.name + "_ORM", size, size, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(px.ravel()); img.pack()
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    return m

def finish(obj, material, bevel=0.0, segments=3, smooth=True):
    obj.data.materials.clear(); obj.data.materials.append(material)
    if bevel:
        bm = obj.modifiers.new("bevel", "BEVEL"); bm.width = bevel; bm.segments = segments
        bm.limit_method = "ANGLE"; bm.angle_limit = math.radians(35)
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
        if hasattr(obj.data, "use_auto_smooth"):
            obj.data.use_auto_smooth = True; obj.data.auto_smooth_angle = math.radians(40)
    return obj

def active():
    return bpy.context.active_object

def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); o = active(); o.name = name
    return o


# ---------- Kaelis: metal core, glowing seam, one eye ----------
def build_kaelis():
    gun = wear_map(mat("K_Gunmetal", (0.075, 0.08, 0.09), metallic=1.0, rough=0.34), 0.24, 0.5, seed=3)
    plate = wear_map(mat("K_FacePlate", (0.11, 0.115, 0.125), metallic=1.0, rough=0.26), 0.16, 0.36, seed=7)
    steel = mat("K_Bezel", (0.78, 0.79, 0.8), metallic=1.0, rough=0.16)
    glow = mat("K_SeamGlow", (0.02, 0.05, 0.045), rough=0.4, emit=MINT, emit_strength=8.0)
    iris = mat("K_Iris", (0.02, 0.05, 0.045), rough=0.25, emit=MINT, emit_strength=10.0)
    pupil = mat("K_Pupil", (0.01, 0.012, 0.014), rough=0.35)
    lens = mat("K_Lens", (0.02, 0.03, 0.035), rough=0.03, alpha=0.18)
    rubber = mat("K_Socket", (0.02, 0.02, 0.022), rough=0.7)
    parts = []

    # outer shell: sphere split by a ring seam (plane y = SEAM) into face plate (front) and body (back)
    SEAM, GAP = -0.32, 0.06
    for side in ("front", "back"):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=1.0)
        o = active(); o.name = "K_" + side
        o.rotation_euler = (math.radians(90), 0, 0)   # poles on Y so the seam ring is round
        bpy.ops.object.transform_apply(rotation=True)
        me = o.data
        import bmesh
        bm = bmesh.new(); bm.from_mesh(me)
        kill = [f for f in bm.faces if (f.calc_center_median().y > SEAM - GAP) == (side == "front")]
        bmesh.ops.delete(bm, geom=kill, context="FACES"); bm.to_mesh(me); bm.free()
        sol = o.modifiers.new("solid", "SOLIDIFY"); sol.thickness = 0.05; sol.offset = -1
        finish(o, plate if side == "front" else gun, bevel=0.012)
        parts.append(o)

    # glowing inner core seen through the seam
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.93)
    parts.append(finish(active(), glow))

    # panel lines on the back body: shallow rings (detail that catches light)
    for k, y in enumerate((0.15, 0.55)):
        r = math.sqrt(max(0.0, 1 - y * y)) + 0.004
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.012, major_segments=128, minor_segments=8,
                                         location=(0, y, 0), rotation=(math.radians(90), 0, 0))
        parts.append(finish(active(), gun))

    # eye assembly, facing -Y
    ey = -0.955
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.42, depth=0.12, location=(0, ey + 0.02, 0), rotation=(math.radians(90), 0, 0))
    parts.append(finish(active(), rubber, bevel=0.01))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.055, major_segments=128, minor_segments=24,
                                     location=(0, ey - 0.03, 0), rotation=(math.radians(90), 0, 0))
    parts.append(finish(active(), steel))
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.30, depth=0.02, location=(0, ey - 0.045, 0), rotation=(math.radians(90), 0, 0))
    parts.append(finish(active(), iris, bevel=0.004))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.008, major_segments=96, minor_segments=8,
                                     location=(0, ey - 0.057, 0), rotation=(math.radians(90), 0, 0))
    parts.append(finish(active(), pupil))
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.105, depth=0.02, location=(0, ey - 0.06, 0), rotation=(math.radians(90), 0, 0))
    parts.append(finish(active(), pupil, bevel=0.004))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.37, location=(0, ey - 0.02, 0))
    o = active(); o.scale = (1, 0.22, 1); bpy.ops.object.transform_apply(scale=True)
    parts.append(finish(o, lens))

    # small hex screws around the bezel
    for i in range(6):
        a = i / 6 * math.tau + math.pi / 6
        x, z = math.cos(a) * 0.56, math.sin(a) * 0.56
        y = -math.sqrt(max(0.0, 1 - x * x - z * z)) - 0.005
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.032, depth=0.03, location=(x, y, z))
        o = active(); o.rotation_euler = Vector((x, y, z)).to_track_quat("Z", "Y").to_euler()
        parts.append(finish(o, steel, bevel=0.006, smooth=False))

    for o in parts:
        for m in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
    return parts


# ---------- Hammer of light ----------
def build_hammer():
    forged = wear_map(mat("H_Forged", (0.10, 0.10, 0.11), metallic=1.0, rough=0.42), 0.3, 0.66, seed=11)
    polish = wear_map(mat("H_Face", (0.72, 0.72, 0.73), metallic=1.0, rough=0.14), 0.07, 0.24, seed=13)
    ember = mat("H_Ember", (0.05, 0.022, 0.012), rough=0.4, emit=EMBER, emit_strength=9.0)
    leather = mat("H_Grip", (0.055, 0.04, 0.032), rough=0.72)
    shaft = mat("H_Shaft", (0.045, 0.03, 0.022), rough=0.48, coat=0.4)
    parts = []
    HZ = 1.78  # head height (handle runs along +Z from 0)

    # shaft
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.078, depth=1.72, location=(0, 0, 0.86))
    parts.append(finish(active(), shaft, bevel=0.01))
    # leather grip: stacked wraps
    for i in range(16):
        z = 0.08 + i * 0.045
        bpy.ops.mesh.primitive_torus_add(major_radius=0.085, minor_radius=0.021, major_segments=48, minor_segments=12,
                                         location=(0, 0, z), rotation=(math.radians(4), 0, 0))
        parts.append(finish(active(), leather))
    # pommel + collar
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.1, depth=0.09, location=(0, 0, 0.0))
    parts.append(finish(active(), forged, bevel=0.015))
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.085, depth=0.14, location=(0, 0, HZ - 0.24))
    parts.append(finish(active(), forged, bevel=0.012))

    # head block (long axis X), chamfered
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, HZ))
    o = active(); o.scale = (0.62, 0.34, 0.34); bpy.ops.object.transform_apply(scale=True)
    parts.append(finish(o, forged, bevel=0.035, segments=4))
    # octagonal necks + striking faces on both ends
    for s in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.19, depth=0.16, location=(s * 0.39, 0, HZ), rotation=(0, math.radians(90), math.radians(22.5)))
        parts.append(finish(active(), forged, bevel=0.012, smooth=False))
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.175, depth=0.05, location=(s * 0.485, 0, HZ), rotation=(0, math.radians(90), 0))
        parts.append(finish(active(), polish, bevel=0.012))
    # ember inlays: glowing grooves on the front and back faces of the head
    for y in (-0.172, 0.172):
        for z in (-0.07, 0.07):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, HZ + z))
            o = active(); o.scale = (0.5, 0.012, 0.022); bpy.ops.object.transform_apply(scale=True)
            parts.append(finish(o, ember, bevel=0.004, smooth=False))
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.05, depth=0.012, location=(0, y, HZ), rotation=(math.radians(90), 0, 0))
        parts.append(finish(active(), ember, smooth=False))
    # wedge on top where the shaft comes through
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.07, depth=0.03, location=(0, 0, HZ + 0.17))
    parts.append(finish(active(), polish, bevel=0.008))

    for o in parts:
        for m in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
    return parts


# ---------- export + preview ----------
def export(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "tools", "3d", name + ".blend"))
    print("EXPORTED", path, os.path.getsize(path))

def preview(name, cam_loc, target, lens=70):
    sc = bpy.context.scene
    w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
    nt = w.node_tree; env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(HDRI)
    nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
    # paper-white backdrop like the site, plus a floor catcher
    low = min((o.matrix_world @ Vector(c)).z for o in sc.objects if o.type == "MESH" for c in o.bound_box)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, low - 0.15))
    floor = active(); floor.data.materials.append(mat("Paper", (0.93, 0.925, 0.91), rough=0.9))
    cam = bpy.data.cameras.new("C"); cam.lens = lens; co = bpy.data.objects.new("C", cam); sc.collection.objects.link(co)
    co.location = cam_loc; co.rotation_euler = (Vector(target) - Vector(cam_loc)).to_track_quat("-Z", "Y").to_euler(); sc.camera = co
    sc.render.engine = "BLENDER_EEVEE"
    e = sc.eevee
    for k, v in (("use_gtao", True), ("use_bloom", True), ("use_ssr", True), ("taa_render_samples", 64)):
        if hasattr(e, k): setattr(e, k, v)
    sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    sc.render.resolution_x = sc.render.resolution_y = 900
    sc.render.filepath = os.path.join(PREVIEW, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("PREVIEW", sc.render.filepath)


reset(); k = build_kaelis(); export(k, "kaelis"); preview("kaelis", (2.4, -5.2, 1.2), (0, 0, 0))
reset(); h = build_hammer(); export(h, "hammer"); preview("hammer", (3.4, -5.6, 1.9), (0, 0, 1.15), lens=60)
