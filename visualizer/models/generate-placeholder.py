#!/usr/bin/env python3
"""
Generates house-placeholder.glb — a temporary, clearly-blocky box-massing
house that follows the exact node/material naming convention documented in
ASSET-SPEC.md. It exists only so the Three.js application has something real
to load while a professionally modeled house is commissioned. Replace the
output file with an artist-delivered GLB that uses the same MAT_* material
names and the app requires zero code changes.

Requires: pip install pygltflib
Run: python3 generate-placeholder.py
"""
import math
import struct
from pygltflib import (
    GLTF2, Asset, Scene, Node, Mesh, Primitive, Attributes, Accessor,
    BufferView, Buffer, Material, PbrMetallicRoughness, FLOAT, UNSIGNED_SHORT,
    ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, SCALAR, VEC2, VEC3
)

# ---------------------------------------------------------------------------
# Low-level glTF buffer builder
# ---------------------------------------------------------------------------

class Builder:
    def __init__(self):
        self.blob = bytearray()
        self.accessors = []
        self.bufferViews = []
        self.meshes = []
        self.materials = []
        self.nodes = []
        self.mat_index = {}

    def _pad(self):
        while len(self.blob) % 4 != 0:
            self.blob += b'\x00'

    def add_buffer_view(self, data, target):
        self._pad()
        offset = len(self.blob)
        self.blob += data
        bv = BufferView(buffer=0, byteOffset=offset, byteLength=len(data), target=target)
        self.bufferViews.append(bv)
        return len(self.bufferViews) - 1

    def add_accessor(self, values, kind, component_type, target, minmax=False):
        flat = b''.join(struct.pack('<' + 'f' * len(v), *v) if isinstance(v, (list, tuple)) else struct.pack('<f', v) for v in values)
        bv_index = self.add_buffer_view(flat, target)
        acc = Accessor(bufferView=bv_index, componentType=component_type, count=len(values), type=kind)
        if minmax and kind in (VEC3,):
            xs = [v[0] for v in values]; ys = [v[1] for v in values]; zs = [v[2] for v in values]
            acc.min = [min(xs), min(ys), min(zs)]
            acc.max = [max(xs), max(ys), max(zs)]
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def add_index_accessor(self, indices):
        data = struct.pack('<' + 'H' * len(indices), *indices)
        bv_index = self.add_buffer_view(data, ELEMENT_ARRAY_BUFFER)
        acc = Accessor(bufferView=bv_index, componentType=UNSIGNED_SHORT, count=len(indices), type=SCALAR)
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def get_material(self, name, base_color, roughness=0.85, metallic=0.0, alpha=1.0):
        if name in self.mat_index:
            return self.mat_index[name]
        mat = Material(
            name=name,
            pbrMetallicRoughness=PbrMetallicRoughness(
                baseColorFactor=[base_color[0], base_color[1], base_color[2], alpha],
                metallicFactor=metallic,
                roughnessFactor=roughness,
            ),
        )
        if alpha < 1.0:
            mat.alphaMode = "BLEND"
        self.materials.append(mat)
        idx = len(self.materials) - 1
        self.mat_index[name] = idx
        return idx


UNIT_BOX = None  # (pos_accessor, normal_accessor, uv_accessor, index_accessor) cache per Builder


def unit_box_accessors(b: Builder):
    """A single reusable unit cube (half-extent 0.5) — every placeholder part
    reuses this geometry and is sized/placed purely via node TRS, so the file
    stays tiny and every box is guaranteed watertight with correct normals."""
    global UNIT_BOX
    if UNIT_BOX is not None:
        return UNIT_BOX

    # 24 verts (4 per face) so UVs/normals are per-face-correct.
    faces = [
        # (normal, 4 corner offsets CCW as seen from outside)
        ((0, 0, 1),  [(-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (0.5, 0.5, 0.5), (-0.5, 0.5, 0.5)]),   # +Z front
        ((0, 0, -1), [(0.5, -0.5, -0.5), (-0.5, -0.5, -0.5), (-0.5, 0.5, -0.5), (0.5, 0.5, -0.5)]), # -Z back
        ((1, 0, 0),  [(0.5, -0.5, 0.5), (0.5, -0.5, -0.5), (0.5, 0.5, -0.5), (0.5, 0.5, 0.5)]),    # +X right
        ((-1, 0, 0), [(-0.5, -0.5, -0.5), (-0.5, -0.5, 0.5), (-0.5, 0.5, 0.5), (-0.5, 0.5, -0.5)]),# -X left
        ((0, 1, 0),  [(-0.5, 0.5, 0.5), (0.5, 0.5, 0.5), (0.5, 0.5, -0.5), (-0.5, 0.5, -0.5)]),    # +Y top
        ((0, -1, 0), [(-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), (0.5, -0.5, 0.5), (-0.5, -0.5, 0.5)]),# -Y bottom
    ]
    positions, normals, uvs, indices = [], [], [], []
    for normal, corners in faces:
        base = len(positions)
        for ci, c in enumerate(corners):
            positions.append(c)
            normals.append(normal)
        uvs += [(0, 1), (1, 1), (1, 0), (0, 0)]
        indices += [base, base + 1, base + 2, base, base + 2, base + 3]

    pos_acc = b.add_accessor(positions, VEC3, FLOAT, ARRAY_BUFFER, minmax=True)
    norm_acc = b.add_accessor(normals, VEC3, FLOAT, ARRAY_BUFFER)
    uv_acc = b.add_accessor(uvs, VEC2, FLOAT, ARRAY_BUFFER)
    idx_acc = b.add_index_accessor(indices)
    UNIT_BOX = (pos_acc, norm_acc, uv_acc, idx_acc)
    return UNIT_BOX


def add_box_node(b: Builder, name, material_idx, size, position, rotation_deg=(0, 0, 0), parent_children=None):
    """size=(sx,sy,sz) in meters, position=(x,y,z) center, rotation in degrees (XYZ euler, applied as quaternion)."""
    pos_acc, norm_acc, uv_acc, idx_acc = unit_box_accessors(b)
    mesh = Mesh(name=name, primitives=[Primitive(
        attributes=Attributes(POSITION=pos_acc, NORMAL=norm_acc, TEXCOORD_0=uv_acc),
        indices=idx_acc, material=material_idx,
    )])
    b.meshes.append(mesh)
    mesh_idx = len(b.meshes) - 1

    qx, qy, qz, qw = euler_to_quat(*[math.radians(d) for d in rotation_deg])
    node = Node(name=name, mesh=mesh_idx, translation=list(position),
                rotation=[qx, qy, qz, qw], scale=list(size))
    b.nodes.append(node)
    node_idx = len(b.nodes) - 1
    if parent_children is not None:
        parent_children.append(node_idx)
    return node_idx


def euler_to_quat(x, y, z):
    cx, sx = math.cos(x / 2), math.sin(x / 2)
    cy, sy = math.cos(y / 2), math.sin(y / 2)
    cz, sz = math.cos(z / 2), math.sin(z / 2)
    qx = sx * cy * cz - cx * sy * sz
    qy = cx * sy * cz + sx * cy * sz
    qz = cx * cy * sz - sx * sy * cz
    qw = cx * cy * cz + sx * sy * sz
    return qx, qy, qz, qw


def add_gable_node(b: Builder, name, material_idx, thickness, rise, depth, position, parent_children=None):
    """A flat triangular wall panel (gable end infill) extruded to `thickness`
    — vertical-ish, facing outward along local X, NOT a solid wedge. Base
    corners at local y=0 (the eave line) spanning z=[-depth/2, depth/2];
    apex at local y=rise, z=0 (the ridge). Earlier this was approximated
    with a full-height, full-depth box, which is exactly the oversized
    rectangular block that made the roofline look broken/deformed."""
    t = thickness / 2.0
    d = depth / 2.0
    A0 = (-t, 0.0, -d); B0 = (-t, 0.0, d); C0 = (-t, rise, 0.0)
    A1 = (t, 0.0, -d); B1 = (t, 0.0, d); C1 = (t, rise, 0.0)

    positions, normals, uvs, indices = [], [], [], []

    def add_tri(p0, p1, p2, uv0=(0, 0), uv1=(1, 0), uv2=(0.5, 1)):
        base = len(positions)
        v1 = tuple(p1[i] - p0[i] for i in range(3))
        v2 = tuple(p2[i] - p0[i] for i in range(3))
        n = (
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0],
        )
        length = math.sqrt(sum(c * c for c in n)) or 1.0
        n = tuple(c / length for c in n)
        for p, uv in ((p0, uv0), (p1, uv1), (p2, uv2)):
            positions.append(p)
            normals.append(n)
            uvs.append(uv)
        indices.extend([base, base + 1, base + 2])

    def add_quad(p0, p1, p2, p3):
        add_tri(p0, p1, p2, (0, 0), (1, 0), (1, 1))
        add_tri(p0, p2, p3, (0, 0), (1, 1), (0, 1))

    # outward caps — the actual visible triangular wall panels
    add_tri(A0, B0, C0, (0, 0), (1, 0), (0.5, 1))
    add_tri(A1, C1, B1, (0, 0), (0.5, 1), (1, 0))
    # thin edges closing the panel — minor, but keeps the mesh watertight
    add_quad(A0, A1, B1, B0)
    add_quad(A0, C0, C1, A1)
    add_quad(B0, B1, C1, C0)

    pos_acc = b.add_accessor(positions, VEC3, FLOAT, ARRAY_BUFFER, minmax=True)
    norm_acc = b.add_accessor(normals, VEC3, FLOAT, ARRAY_BUFFER)
    uv_acc = b.add_accessor(uvs, VEC2, FLOAT, ARRAY_BUFFER)
    idx_acc = b.add_index_accessor(list(range(len(positions))))

    mesh = Mesh(name=name, primitives=[Primitive(
        attributes=Attributes(POSITION=pos_acc, NORMAL=norm_acc, TEXCOORD_0=uv_acc),
        indices=idx_acc, material=material_idx,
    )])
    b.meshes.append(mesh)
    mesh_idx = len(b.meshes) - 1
    node = Node(name=name, mesh=mesh_idx, translation=list(position))
    b.nodes.append(node)
    node_idx = len(b.nodes) - 1
    if parent_children is not None:
        parent_children.append(node_idx)
    return node_idx


def add_empty_node(b: Builder, name, position=(0, 0, 0), children=None):
    node = Node(name=name, translation=list(position))
    if children:
        node.children = children
    b.nodes.append(node)
    return len(b.nodes) - 1


# ---------------------------------------------------------------------------
# Build the house — a single-story "ranch" massing, ~9m wide x 7m deep
# ---------------------------------------------------------------------------

def build():
    b = Builder()

    WIDTH, DEPTH, WALL_H = 9.0, 7.0, 2.8
    OVERHANG = 0.35
    PITCH_DEG = 24
    WALL_THICKNESS = 0.2
    # Windows/doors sit against the wall's actual OUTER face
    # (DEPTH/2 + WALL_THICKNESS/2), not DEPTH/2 itself — using DEPTH/2 as the
    # base put their frames 4cm inside the wall volume, coincident with/
    # inside the siding and z-fighting with it (the "door glitching").
    FRONT_FACE = DEPTH / 2 + WALL_THICKNESS / 2
    SIDE_FACE = WIDTH / 2 + WALL_THICKNESS / 2

    mat_siding = b.get_material('MAT_Siding', (0.83, 0.80, 0.72), roughness=0.9)
    mat_roof = b.get_material('MAT_Roofing', (0.16, 0.16, 0.17), roughness=0.75)
    mat_trim = b.get_material('MAT_Trim', (0.92, 0.92, 0.90), roughness=0.55)
    mat_found = b.get_material('MAT_Foundation', (0.55, 0.54, 0.52), roughness=0.95)
    mat_frame = b.get_material('MAT_WindowFrame', (0.95, 0.95, 0.94), roughness=0.4)
    mat_glass = b.get_material('MAT_WindowGlass', (0.55, 0.65, 0.68), roughness=0.05, metallic=0.0, alpha=0.35)
    mat_slab = b.get_material('MAT_DoorSlab', (0.30, 0.14, 0.11), roughness=0.5)
    mat_dglass = b.get_material('MAT_DoorGlass', (0.55, 0.65, 0.68), roughness=0.05, alpha=0.35)
    mat_hw = b.get_material('MAT_DoorHardware', (0.72, 0.64, 0.42), roughness=0.35, metallic=0.9)

    body_children = []
    add_box_node(b, 'Body_Front', mat_siding, (WIDTH, WALL_H, WALL_THICKNESS), (0, WALL_H / 2, DEPTH / 2), parent_children=body_children)
    add_box_node(b, 'Body_Back', mat_siding, (WIDTH, WALL_H, WALL_THICKNESS), (0, WALL_H / 2, -DEPTH / 2), parent_children=body_children)
    add_box_node(b, 'Body_Left', mat_siding, (WALL_THICKNESS, WALL_H, DEPTH), (-WIDTH / 2, WALL_H / 2, 0), parent_children=body_children)
    add_box_node(b, 'Body_Right', mat_siding, (WALL_THICKNESS, WALL_H, DEPTH), (WIDTH / 2, WALL_H / 2, 0), parent_children=body_children)
    body_grp = add_empty_node(b, 'Body', children=body_children)

    found_children = []
    # Top face sits 2cm ABOVE y=0 (not flush with it) so it interpenetrates
    # the wall/door bottoms instead of sharing an exactly coincident plane —
    # coincident coplanar faces z-fight (flicker/"glitch" as the camera
    # moves) since the depth buffer can't consistently resolve which face
    # is in front.
    add_box_node(b, 'Foundation', mat_found, (WIDTH + 0.3, 0.54, DEPTH + 0.3), (0, -0.23, 0), parent_children=found_children)
    found_grp = add_empty_node(b, 'Foundation_Group', children=found_children)

    half_depth = DEPTH / 2 + OVERHANG
    rise = half_depth * math.tan(math.radians(PITCH_DEG))
    ridge_y = WALL_H + rise
    slope_len = half_depth / math.cos(math.radians(PITCH_DEG))
    roof_width = WIDTH + OVERHANG * 2
    mid_y = (WALL_H + ridge_y) / 2

    roof_children = []
    add_box_node(b, 'Roof_Front', mat_roof, (roof_width, 0.12, slope_len), (0, mid_y, DEPTH / 4 + OVERHANG / 4),
                 rotation_deg=(PITCH_DEG, 0, 0), parent_children=roof_children)
    add_box_node(b, 'Roof_Back', mat_roof, (roof_width, 0.12, slope_len), (0, mid_y, -(DEPTH / 4 + OVERHANG / 4)),
                 rotation_deg=(-PITCH_DEG, 0, 0), parent_children=roof_children)
    add_box_node(b, 'Roof_Ridge', mat_roof, (roof_width, 0.14, 0.14), (0, ridge_y, 0), parent_children=roof_children)
    add_gable_node(b, 'Roof_GableFill_Left', mat_siding, 0.15, rise, DEPTH,
                   (-WIDTH / 2, WALL_H, 0), parent_children=roof_children)
    add_gable_node(b, 'Roof_GableFill_Right', mat_siding, 0.15, rise, DEPTH,
                   (WIDTH / 2, WALL_H, 0), parent_children=roof_children)
    roof_grp = add_empty_node(b, 'Roof', children=roof_children)

    trim_children = []
    add_box_node(b, 'Trim_Fascia_Front', mat_trim, (roof_width, 0.14, 0.14), (0, WALL_H, DEPTH / 2 + OVERHANG), parent_children=trim_children)
    add_box_node(b, 'Trim_Fascia_Back', mat_trim, (roof_width, 0.14, 0.14), (0, WALL_H, -(DEPTH / 2 + OVERHANG)), parent_children=trim_children)
    for cx in (-WIDTH / 2, WIDTH / 2):
        add_box_node(b, f'Trim_CornerBoard_{"L" if cx < 0 else "R"}', mat_trim, (0.22, WALL_H, 0.22), (cx, WALL_H / 2, 0), parent_children=trim_children)
    trim_grp = add_empty_node(b, 'Trim', children=trim_children)

    # side: which exterior wall the window sits on. `coord` is position along
    # that wall's run — x for front/back, z for left/right. Frame sits a flat
    # 6cm proud of the wall's outer face; glass sits a further 9cm proud of
    # the wall (i.e. 3cm clear of the frame's own outer face) so neither
    # shares an exactly coincident plane with the wall or with each other —
    # coincident planes z-fight (flicker) since the depth buffer can't
    # consistently resolve which surface is in front.
    def make_window(name, side, coord, sill_y, w=1.15, h=1.25):
        children = []
        y = sill_y + h / 2
        frame_t, glass_t, standoff, clearance = 0.10, 0.02, 0.06, 0.03
        if side in ('front', 'back'):
            outward = 1 if side == 'front' else -1
            frame_pos_axis = outward * FRONT_FACE + outward * standoff
            glass_pos_axis = frame_pos_axis + outward * (frame_t / 2 + clearance + glass_t / 2)
            add_box_node(b, f'{name}_Frame', mat_frame, (w + 0.16, h + 0.16, frame_t), (coord, y, frame_pos_axis), parent_children=children)
            add_box_node(b, f'{name}_Glass', mat_glass, (w - 0.08, h - 0.08, glass_t), (coord, y, glass_pos_axis), parent_children=children)
        else:
            outward = 1 if side == 'right' else -1
            frame_pos_axis = outward * SIDE_FACE + outward * standoff
            glass_pos_axis = frame_pos_axis + outward * (frame_t / 2 + clearance + glass_t / 2)
            add_box_node(b, f'{name}_Frame', mat_frame, (frame_t, h + 0.16, w + 0.16), (frame_pos_axis, y, coord), parent_children=children)
            add_box_node(b, f'{name}_Glass', mat_glass, (glass_t, h - 0.08, w - 0.08), (glass_pos_axis, y, coord), parent_children=children)
        return add_empty_node(b, name, children=children)

    windows_children = [
        make_window('Window_Front_01', 'front', -3.0, 1.0),
        make_window('Window_Front_02', 'front', -0.9, 1.0),
        make_window('Window_Front_03', 'front', 3.0, 1.0, w=1.5),
        make_window('Window_Back_01', 'back', -3.0, 1.0),
        make_window('Window_Back_02', 'back', 0.0, 1.0, w=1.5),
        make_window('Window_Back_03', 'back', 3.0, 1.0),
        make_window('Window_Left_01', 'left', -2.0, 1.0, w=1.0, h=1.15),
        make_window('Window_Left_02', 'left', 1.6, 1.0, w=1.0, h=1.15),
        make_window('Window_Right_01', 'right', -2.0, 1.0, w=1.0, h=1.15),
        make_window('Window_Right_02', 'right', 1.6, 1.0, w=1.0, h=1.15),
    ]
    windows_grp = add_empty_node(b, 'Windows', children=windows_children)

    door_children = []
    dx, dw, dh = 1.15, 1.0, 2.05
    cz = FRONT_FACE + 0.06
    # Slab is 0.08 thick (half=0.04), so its outer face sits at cz+0.04 — glass
    # and hardware need to clear that by more than a hair or they land on the
    # same plane as the slab face and z-fight (this is what was "glitching"
    # on the door's glass panel: it previously sat exactly flush with it).
    add_box_node(b, 'Door_Front_Slab', mat_slab, (dw, dh, 0.08), (dx, dh / 2, cz), parent_children=door_children)
    add_box_node(b, 'Door_Front_Glass', mat_dglass, (0.32, 0.7, 0.02), (dx, dh * 0.68, cz + 0.07), parent_children=door_children)
    add_box_node(b, 'Door_Front_Hardware', mat_hw, (0.05, 0.05, 0.05), (dx + dw / 2 - 0.12, dh * 0.5, cz + 0.08), parent_children=door_children)
    add_box_node(b, 'Door_Front_Trim', mat_trim, (dw + 0.2, dh + 0.14, 0.10), (dx, dh / 2, cz - 0.05), parent_children=door_children)
    door_grp = add_empty_node(b, 'Door_Front', children=door_children)
    doors_grp = add_empty_node(b, 'Doors', children=[door_grp])

    ground_anchor = add_empty_node(b, 'Ground_Anchor', position=(0, 0, 0))

    root_children = [body_grp, found_grp, roof_grp, trim_grp, windows_grp, doors_grp, ground_anchor]
    root = add_empty_node(b, 'House_Root', children=root_children)

    gltf = GLTF2(
        asset=Asset(generator='Northern Pines placeholder generator', version='2.0'),
        scene=0,
        scenes=[Scene(nodes=[root])],
        nodes=b.nodes,
        meshes=b.meshes,
        materials=b.materials,
        accessors=b.accessors,
        bufferViews=b.bufferViews,
    )
    gltf.buffers = [Buffer(byteLength=len(b.blob))]
    gltf.set_binary_blob(bytes(b.blob))
    return gltf


if __name__ == '__main__':
    import os
    gltf = build()
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'house-placeholder.glb')
    gltf.save_binary(out)
    print('wrote', out)
