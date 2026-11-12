"""The Kaelis K, swaying on its plate: an image sequence for the videos (a seamless loop).

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/logo_k_spin.py -- <out_dir> [frames=96] [width=1920] [height=1080]

Builds the K with the geometry part of logo_k.py, then turns it +-32 degrees around its own axis over the loop.
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0]
N = int(ARGS[1]) if len(ARGS) > 1 else 96
W = int(ARGS[2]) if len(ARGS) > 2 else 1920
H = int(ARGS[3]) if len(ARGS) > 3 else 1080

src = open(os.path.join(HERE, "logo_k.py"), encoding="utf-8").read().split("# ---- stage and light")[0]
sys.argv = [sys.argv[0], "--", OUT, "dark"]
exec(compile(src, "logo_k.py", "exec"))
scene = bpy.context.scene

# everything turns around one pivot under the middle of the mark
pivot = bpy.data.objects.new("Pivot", None)
pivot.location = (0.12, 0, 0)
scene.collection.objects.link(pivot)
bpy.context.view_layer.update()
for o in list(bpy.data.objects):
    if o.type == "MESH":
        mw = o.matrix_world.copy()
        o.parent = pivot
        o.matrix_parent_inverse = pivot.matrix_world.inverted()
        o.matrix_world = mw

bgc = (0.010, 0.012, 0.015)
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*bgc, 1)
fl = bpy.data.materials.new("floor")
fl.use_nodes = True
fb = next(n for n in fl.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
fb.inputs["Base Color"].default_value = (0.012, 0.014, 0.017, 1)
fb.inputs["Roughness"].default_value = 0.3
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, -0.05))
bpy.context.object.data.materials.append(fl)


def light(name, loc, energy, size, color=(1, 1, 1), aim=(0, 0, 1.5)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy, size, color
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)


light("Key", (-3.4, -5.0, 5.4), 620, 2.6, (1, 0.97, 0.94))
light("Rim", (3.6, 3.4, 4.4), 520, 1.6, (0.75, 0.92, 1.0), aim=(0.2, 0, 1.9))
light("Fill", (4.2, -4.8, 1.6), 110, 4.0, (0.85, 1, 0.95))
light("Top", (0.1, -0.4, 6.0), 200, 2.2, aim=(0.1, 0, 1.2))

cd = bpy.data.cameras.new("Cam")
cd.lens = 60
cam = bpy.data.objects.new("Cam", cd)
cam.location = (-1.2, -13.5, 2.5)
cam.rotation_euler = (Vector((0.12, 0, 1.46)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(cam)
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == "OPTIX"
scene.cycles.samples = 72
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 12
scene.cycles.transmission_bounces = 12
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -0.35
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 93
os.makedirs(OUT, exist_ok=True)
for f in range(N):
    pivot.rotation_euler = (0, 0, math.radians(32) * math.sin(2 * math.pi * f / N))
    scene.render.filepath = os.path.join(OUT, "k%04d.jpg" % f)
    bpy.ops.render.render(write_still=True)
    if f % 12 == 0:
        print("SPIN frame", f, "/", N, flush=True)
print("SPIN done", OUT)
