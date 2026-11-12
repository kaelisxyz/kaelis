"""The Kaelis K: a 3D mark built from the project's own parts.

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/logo_k.py -- <out.png> [dark|light] [size]

The stem is the white lab tower (enamel, bands of lit windows: one band per sealed call).
The two arms are specimen tubes: glass, steel collars, mint liquid that glows.
Where they meet sits the Kaelis eye. 1 unit = 1 m, the K is 3 m tall, front faces -Y.
"""
import bpy, math, os, sys, random
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else os.path.join(os.path.dirname(os.path.abspath(__file__)), "work", "logo-k.png")
MODE = ARGS[1] if len(ARGS) > 1 else "dark"
SIZE = int(ARGS[2]) if len(ARGS) > 2 else 1600
MINT = (0.1, 0.82, 0.62)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
random.seed(7)


def mat(name, col, rough=0.4, metal=0.0, emit=None, strength=0.0, trans=0.0, ior=1.45, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


M = dict(
    enamel=mat("enamel", (0.9, 0.91, 0.92), 0.22, coat=0.6),
    steel=mat("steel", (0.72, 0.73, 0.75), 0.18, 1.0),
    dark=mat("dark", (0.015, 0.017, 0.02), 0.3, 0.6),
    glass=mat("glass", (1, 1, 1), 0.0, trans=1.0, ior=1.47),
    liquid=mat("liquid", (0.01, 0.42, 0.3), 0.04, emit=(0.04, 0.85, 0.56), strength=1.15, trans=0.25, ior=1.33),
    band=mat("band", (0, 0, 0), 0.3, emit=(0.06, 0.9, 0.6), strength=3.2),
    lens=mat("lens", (0, 0, 0), 0.05, emit=(0.06, 0.9, 0.6), strength=7.0),
    bubble=mat("bubble", (1, 1, 1), 0.0, emit=(0.7, 1, 0.9), strength=3.0),
)


def done(o, m, name, smooth=True):
    o.name = name
    o.data.materials.append(M[m])
    if smooth:
        bpy.ops.object.shade_smooth()
    return o


def box(size, loc, m, name, bevel=0.03, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        md = o.modifiers.new("b", "BEVEL")
        md.width = bevel
        md.segments = 5
    return done(o, m, name, smooth=bool(bevel))


def tube(a, b, r, m, name, caps=True, v=64):
    """A capsule from a to b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    q = d.to_track_quat("Z", "Y").to_euler()
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d.length, location=(a + b) / 2, rotation=q)
    parts = [bpy.context.object]
    if caps:
        for p in (a, b):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=v, ring_count=v // 2, radius=r, location=p)
            parts.append(bpy.context.object)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    return done(bpy.context.object, m, name)


def ring(a, b, t, r, w, m, name):
    """A collar around the tube a->b at fraction t."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=r, depth=w, location=a + d * t, rotation=d.to_track_quat("Z", "Y").to_euler())
    o = bpy.context.object
    md = o.modifiers.new("b", "BEVEL")
    md.width = 0.012
    md.segments = 3
    return done(o, m, name)


# ---- the stem: the white tower
SX, SW, SH = -0.78, 0.66, 3.0
box((SW, SW, SH), (SX, 0, SH / 2), "enamel", "Stem", bevel=0.055)
for i in range(9):                                   # bands of lit windows, like the floors of the tower
    box((SW + 0.012, SW + 0.012, 0.062), (SX, 0, 0.36 + i * 0.285), "band", "Band%d" % i, bevel=0)
box((SW + 0.07, SW + 0.07, 0.09), (SX, 0, SH - 0.045), "steel", "Crown", bevel=0.02)
box((SW + 0.07, SW + 0.07, 0.11), (SX, 0, 0.055), "steel", "Foot", bevel=0.02)

# ---- the arms: specimen tubes
J = (SX + SW / 2 - 0.06, 0, 1.52)
UP, DN = (1.1, 0, 2.86), (1.1, 0, 0.30)
R = 0.27
for tag, end, fill in (("Up", UP, 0.62), ("Dn", DN, 1.0)):
    tube(J, end, R, "glass", "Glass" + tag)
    a, b = Vector(J), Vector(end)
    tube(a + (b - a) * 0.04, a + (b - a) * fill, R - 0.045, "liquid", "Liquid" + tag)
    ring(J, end, 0.2, R + 0.035, 0.16, "steel", "Collar" + tag)       # where the tube leaves the tower
    ring(J, end, 0.275, R + 0.02, 0.03, "band", "CollarLine" + tag)
    ring(J, end, 0.985, R + 0.03, 0.13, "steel", "Cap" + tag)         # the sealed end
    for k in range(16):                                                 # bubbles
        t = random.uniform(0.3, 0.93 if fill == 1.0 else 0.6)
        off = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))).normalized() * random.uniform(0, R - 0.1)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=random.uniform(0.012, 0.03), location=a + (b - a) * t + off)
        done(bpy.context.object, "bubble", "Bubble")

# ---- the eye at the junction
EY = (SX, -SW / 2 - 0.012, 1.52)
bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.035, location=EY, rotation=(math.pi / 2, 0, 0))
done(bpy.context.object, "steel", "EyeRing")
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.17, depth=0.02, location=(EY[0], EY[1] + 0.004, EY[2]), rotation=(math.pi / 2, 0, 0))
done(bpy.context.object, "dark", "EyeGlass")
bpy.ops.mesh.primitive_torus_add(major_radius=0.085, minor_radius=0.02, location=(EY[0], EY[1] - 0.008, EY[2]), rotation=(math.pi / 2, 0, 0))
done(bpy.context.object, "lens", "EyeIris")

# ---- the bay it stands on
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=1.95, depth=0.05, location=(0.1, 0, -0.025))
done(bpy.context.object, "steel" if MODE == "light" else "dark", "Plate")
bpy.ops.mesh.primitive_torus_add(major_radius=1.78, minor_radius=0.012, major_segments=128, location=(0.1, 0, 0.004))
done(bpy.context.object, "band", "PlateRing")

# ---- stage and light
dark = MODE != "light"
bgc = (0.012, 0.014, 0.017) if dark else (0.86, 0.88, 0.9)
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*bgc, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0 if dark else 0.9
floor = mat("floor", bgc, 0.42 if dark else 0.45, 0.0)
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.05))
bpy.context.object.data.materials.append(floor)
if not dark:
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 9, 10), rotation=(math.pi / 2, 0, 0))
    bpy.context.object.data.materials.append(floor)


def light(name, loc, energy, size, color=(1, 1, 1), aim=(0, 0, 1.5)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy, size, color
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)


light("Key", (-3.4, -5.0, 5.4), 620 if dark else 700, 2.6, (1, 0.97, 0.94))
light("Rim", (3.6, 3.4, 4.4), 520 if dark else 420, 1.6, (0.75, 0.92, 1.0), aim=(0.2, 0, 1.9))
light("Fill", (4.2, -4.8, 1.6), 110 if dark else 320, 4.0, (0.85, 1, 0.95))
light("Top", (0.1, -0.4, 6.0), 200 if dark else 380, 2.2, aim=(0.1, 0, 1.2))

cd = bpy.data.cameras.new("Cam")
cd.lens = 85
cam = bpy.data.objects.new("Cam", cd)
cam.location = (-3.3, -10.6, 3.1)
cam.rotation_euler = (Vector((0.12, 0, 1.42)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(cam)
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == "OPTIX"
scene.cycles.samples = 320
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 16
scene.cycles.transmission_bounces = 16
scene.cycles.glossy_bounces = 8
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -0.35 if dark else -0.2
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("LOGO", OUT)
