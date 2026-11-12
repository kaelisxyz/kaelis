"""Bake the clean corridor's lighting into one texture and export it for the site (same method as bake_lab.py).

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b tools/3d/work/clean_hall.blend -P tools/3d/bake_hall.py

Input : tools/3d/work/clean_hall.blend (built through the Blender MCP; see DESIGN_NOTES.md).
Output: tools/3d/work/hall.raw.glb, hall_shell.png  (compress into site/models/hall.glb + site/media/hall_shell.webp)

The whole look is baked (Cycles "combined": direct light, bounce light, shadows, colour) into one atlas per group,
so the site draws the room unlit and it looks like the render. Light is baked at 0.6x so highlights keep headroom
in an 8-bit file; the site multiplies it back (see `LAB_GAIN` in site/index.html).
"""
import bpy, os

WORK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work")
GAIN = 0.6
SIZE = 4096
SHELL = ("Floor", "Ceiling", "Wall", "Joint", "Tbar", "Panel", "Skirt", "Mint", "Vent", "Duct", "Tray", "Cable", "Window", "WinMull", "WinRail", "Exit", "Door")

scene = bpy.context.scene
D = bpy.data.objects
for o in [o for o in D if o.type != "MESH" or o.name.startswith("P_Plant")]:
    D.remove(o, do_unlink=True)

# light at 0.6x (headroom for the 8-bit atlas)
for m in bpy.data.materials:
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                n.inputs["Emission Strength"].default_value *= GAIN
bg = scene.world.node_tree.nodes["Background"]
bg.inputs[1].default_value *= GAIN


def select(obs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]


# real geometry: apply every modifier
for o in list(D):
    select([o])
    for md in list(o.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=md.name)
        except RuntimeError:
            o.modifiers.remove(md)
    if not o.data.uv_layers:
        o.data.uv_layers.new(name="UVMap")
    o.data.uv_layers[0].name = "UVMap"

glass = [o for o in D if o.name.startswith("Glass_")]
for o in glass:
    o.hide_render = True  # real glass on the site; it must not shadow the bake
shell = [o for o in D if o not in glass]


def join(obs, name):
    select(obs)
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    return o


scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == "OPTIX"
scene.cycles.samples = 256
scene.cycles.use_denoising = True
scene.render.bake.margin = 6
scene.render.bake.target = "IMAGE_TEXTURES"
scene.render.bake.use_clear = True

groups = [(join(shell, "HallShell"), "hall_shell")]
baked = {}
for o, fname in groups:
    select([o])
    lm = o.data.uv_layers.new(name="LM")
    o.data.uv_layers.active = lm               # the bake writes here; textures keep reading the render-active map
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.0025, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    img = bpy.data.images.new(fname, SIZE, SIZE, alpha=False)
    for slot in o.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        nt.nodes.active = node
    print("baking", fname, len(o.data.polygons), "faces")
    bpy.ops.object.bake(type="COMBINED")
    img.filepath_raw = os.path.join(WORK, fname + ".png")
    img.file_format = "PNG"
    img.save()
    baked[o.name] = img

# export: one UV set (the atlas), one placeholder material per group; the site assigns the baked texture
for o, fname in groups:
    for uv in [u for u in o.data.uv_layers if u.name != "LM"]:
        o.data.uv_layers.remove(uv)
    o.data.materials.clear()
    o.data.materials.append(bpy.data.materials.new(fname))
for o in glass:
    o.hide_render = False
    o.data.materials.clear()
    o.data.materials.append(bpy.data.materials.new("lab_glass"))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=os.path.join(WORK, "hall.raw.glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT", export_normals=True)
print("exported", [(o.name, len(o.data.polygons)) for o in D])
