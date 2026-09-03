#!/usr/bin/env python3
"""
Generates the three demo-home GLBs the visualizer ships with:
house-ranch.glb, house-colonial.glb, house-craftsman.glb.

These are box-massing models, not artist work — but they are three
genuinely *different* massings (a wide single-storey side-gable, a two-storey
symmetric colonial, and a front-gable craftsman with a full-width porch), so
the visualizer's home picker changes something real. Every part follows the
node/material naming convention in ASSET-SPEC.md, so an artist-delivered GLB
that uses the same MAT_* names replaces any one of these with zero
application-code changes.

Requires: pip install pygltflib
Run: python3 generate-houses.py
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
        # The shared unit cube's accessor indices. Per-Builder, NOT a module
        # global: this script now writes several files in one process, and
        # accessor indices are only meaningful within the Builder that
        # created them — a cache shared across builds would hand house #2
        # indices belonging to house #1's buffer.
        self.unit_box = None

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

    def add_mesh_node(self, name, positions, normals, uvs, indices, material_idx, position=(0, 0, 0), parent_children=None):
        pos_acc = self.add_accessor(positions, VEC3, FLOAT, ARRAY_BUFFER, minmax=True)
        norm_acc = self.add_accessor(normals, VEC3, FLOAT, ARRAY_BUFFER)
        uv_acc = self.add_accessor(uvs, VEC2, FLOAT, ARRAY_BUFFER)
        idx_acc = self.add_index_accessor(indices)
        mesh = Mesh(name=name, primitives=[Primitive(
            attributes=Attributes(POSITION=pos_acc, NORMAL=norm_acc, TEXCOORD_0=uv_acc),
            indices=idx_acc, material=material_idx,
        )])
        self.meshes.append(mesh)
        node = Node(name=name, mesh=len(self.meshes) - 1, translation=list(position))
        self.nodes.append(node)
        node_idx = len(self.nodes) - 1
        if parent_children is not None:
            parent_children.append(node_idx)
        return node_idx


# ---------------------------------------------------------------------------
# Geometry primitives
# ---------------------------------------------------------------------------

AXES = {'x': (1.0, 0.0, 0.0), 'y': (0.0, 1.0, 0.0), 'z': (0.0, 0.0, 1.0)}


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _normal(p0, p1, p2):
    v1 = tuple(p1[i] - p0[i] for i in range(3))
    v2 = tuple(p2[i] - p0[i] for i in range(3))
    n = _cross(v1, v2)
    length = math.sqrt(sum(c * c for c in n)) or 1.0
    return tuple(c / length for c in n)


def unit_box_accessors(b: Builder):
    """A single reusable unit cube (half-extent 0.5) — every box part reuses
    this geometry and is sized/placed purely via node TRS, so the file stays
    tiny and every box is guaranteed watertight with correct normals."""
    if b.unit_box is not None:
        return b.unit_box

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
        for c in corners:
            positions.append(c)
            normals.append(normal)
        uvs += [(0, 1), (1, 1), (1, 0), (0, 0)]
        indices += [base, base + 1, base + 2, base, base + 2, base + 3]

    pos_acc = b.add_accessor(positions, VEC3, FLOAT, ARRAY_BUFFER, minmax=True)
    norm_acc = b.add_accessor(normals, VEC3, FLOAT, ARRAY_BUFFER)
    uv_acc = b.add_accessor(uvs, VEC2, FLOAT, ARRAY_BUFFER)
    idx_acc = b.add_index_accessor(indices)
    b.unit_box = (pos_acc, norm_acc, uv_acc, idx_acc)
    return b.unit_box


def euler_to_quat(x, y, z):
    cx, sx = math.cos(x / 2), math.sin(x / 2)
    cy, sy = math.cos(y / 2), math.sin(y / 2)
    cz, sz = math.cos(z / 2), math.sin(z / 2)
    qx = sx * cy * cz - cx * sy * sz
    qy = cx * sy * cz + sx * cy * sz
    qz = cx * cy * sz - sx * sy * cz
    qw = cx * cy * cz + sx * sy * sz
    return qx, qy, qz, qw


def add_box_node(b: Builder, name, material_idx, size, position, rotation_deg=(0, 0, 0), parent_children=None):
    """size=(sx,sy,sz) in meters, position=(x,y,z) center, rotation in degrees (XYZ euler, applied as quaternion).

    Rotating by +theta about X tips the +Z end DOWN, so a roof/porch plane on
    the +Z side of the house takes a POSITIVE pitch to slope away from the
    ridge."""
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


def add_extruded_polygon(b: Builder, name, material_idx, poly, u_axis, v_axis, extent,
                         position=(0, 0, 0), parent_children=None):
    """A convex polygon given in the (u_axis, v_axis) plane, extruded `extent`
    metres and centred on the extrusion axis, which is u_axis x v_axis.

    This is how every sloped roof surface and gable infill panel is built.
    Stating the profile in absolute world coordinates (rather than rotating a
    box) is what lets two opposing roof slopes terminate on exactly the same
    mitred ridge line instead of overlapping at some angle — the overlap is
    what used to open up visible seams at steep camera angles and forced the
    camera's polar-angle clamp.
    """
    U, V = AXES[u_axis], AXES[v_axis]
    N = _cross(U, V)
    half = extent / 2.0

    pts = list(poly)
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
               for i in range(len(pts))) / 2.0
    if area < 0:
        pts.reverse()  # keep every profile CCW as seen from +N so the caps face outward

    us = [p[0] for p in pts]; vs = [p[1] for p in pts]
    u_min, u_span = min(us), (max(us) - min(us)) or 1.0
    v_min, v_span = min(vs), (max(vs) - min(vs)) or 1.0

    def world(p, side):
        return tuple(U[i] * p[0] + V[i] * p[1] + N[i] * side * half for i in range(3))

    positions, normals, uvs, indices = [], [], [], []

    def emit(face, face_uvs):
        base = len(positions)
        n = _normal(face[0], face[1], face[2])
        for p, uv in zip(face, face_uvs):
            positions.append(p)
            normals.append(n)
            uvs.append(uv)
        for i in range(1, len(face) - 1):
            indices.extend([base, base + i, base + i + 1])

    cap_uv = [((p[0] - u_min) / u_span, (p[1] - v_min) / v_span) for p in pts]
    emit([world(p, 1) for p in pts], cap_uv)
    emit([world(p, -1) for p in reversed(pts)], list(reversed(cap_uv)))

    for i in range(len(pts)):
        a, c = pts[i], pts[(i + 1) % len(pts)]
        emit([world(a, -1), world(c, -1), world(c, 1), world(a, 1)],
             [(0, 0), (1, 0), (1, 1), (0, 1)])

    # `indices`, not range(len(positions)): every face contributes four
    # vertices that emit() fan-triangulates, so drawing the vertex list
    # straight through would stitch triangles across face boundaries.
    return b.add_mesh_node(name, positions, normals, uvs, indices,
                           material_idx, position, parent_children)


def add_empty_node(b: Builder, name, position=(0, 0, 0), children=None):
    node = Node(name=name, translation=list(position))
    if children:
        node.children = children
    b.nodes.append(node)
    return len(b.nodes) - 1


# ---------------------------------------------------------------------------
# House assemblies
# ---------------------------------------------------------------------------

WALL_T = 0.2      # exterior wall thickness
ROOF_T = 0.14     # roof slab thickness, measured perpendicular to the slope
RIDGE_MITER = 0.02  # how far each slope runs past the ridge line, so the two
                    # interpenetrate rather than sharing an exactly coincident
                    # plane (coincident planes z-fight)


def add_gable_roof(b, mats, children, prefix, ridge_axis, ridge_span, run_span,
                   wall_h, pitch_deg, overhang):
    """Two mitred slopes + a ridge cap + the two triangular gable infill
    panels. `ridge_axis` is the axis the ridge line runs along: 'x' gives a
    side-gable (slopes facing front/back), 'z' a front-facing gable."""
    run_axis = 'z' if ridge_axis == 'x' else 'x'
    t = math.tan(math.radians(pitch_deg))
    half_run = run_span / 2.0 + overhang
    rise = half_run * t
    ridge_y = wall_h + rise
    tv = ROOF_T / math.cos(math.radians(pitch_deg))  # slab thickness measured vertically
    extent = ridge_span + overhang * 2               # rake overhang past both gable ends

    for sign, tag in ((1, 'A'), (-1, 'B')):
        # Profile stated in absolute (run, height) coordinates: the upper edge
        # lands exactly on the ridge line (plus RIDGE_MITER of deliberate
        # overlap), the lower edge on the eave.
        profile = [
            (-sign * RIDGE_MITER, ridge_y + RIDGE_MITER * t),
            (sign * half_run, wall_h),
            (sign * half_run, wall_h - tv),
            (-sign * RIDGE_MITER, ridge_y + RIDGE_MITER * t - tv),
        ]
        add_extruded_polygon(b, f'{prefix}_Slope_{tag}', mats['roof'], profile,
                             run_axis, 'y', extent, parent_children=children)

    ridge_size = {'x': 0.0, 'y': 0.16, 'z': 0.0}
    ridge_size[ridge_axis] = extent
    ridge_size[run_axis] = 0.18
    add_box_node(b, f'{prefix}_Ridge', mats['roof'],
                 (ridge_size['x'], ridge_size['y'], ridge_size['z']),
                 (0, ridge_y + 0.02, 0), parent_children=children)

    # Gable infill: siding, shaped so its sloped top edges lie exactly on the
    # roof's UNDERSIDE plane — the panel is then fully tucked under the roof
    # with no gap at the eave corners and nothing poking through at the ridge.
    shoulder = max(wall_h + overhang * t - tv, wall_h - 0.05)
    half_span = run_span / 2.0
    gable_profile = [
        (-half_span, wall_h - 0.25),
        (half_span, wall_h - 0.25),
        (half_span, shoulder),
        (0, ridge_y - tv),
        (-half_span, shoulder),
    ]
    for sign, tag in ((1, 'A'), (-1, 'B')):
        offset = {'x': 0.0, 'y': 0.0, 'z': 0.0}
        offset[ridge_axis] = sign * ridge_span / 2.0
        add_extruded_polygon(b, f'{prefix}_GableFill_{tag}', mats['siding'], gable_profile,
                             run_axis, 'y', 0.16,
                             position=(offset['x'], offset['y'], offset['z']),
                             parent_children=children)

    return ridge_y, half_run, tv, extent


def add_eave_fascia(b, mats, children, prefix, ridge_axis, wall_h, half_run, tv, extent):
    """Fascia boards closing the two eave cut-faces left by the roof slabs."""
    run_axis = 'z' if ridge_axis == 'x' else 'x'
    for sign, tag in ((1, 'A'), (-1, 'B')):
        size = {'x': 0.0, 'y': tv + 0.03, 'z': 0.0}
        size[ridge_axis] = extent
        size[run_axis] = 0.16
        pos = {'x': 0.0, 'y': wall_h - tv / 2.0, 'z': 0.0}
        pos[run_axis] = sign * (half_run + 0.07)
        add_box_node(b, f'{prefix}_Fascia_{tag}', mats['trim'],
                     (size['x'], size['y'], size['z']),
                     (pos['x'], pos['y'], pos['z']), parent_children=children)


def add_window(b, mats, name, side, coord, sill_y, w, h, faces):
    """`side` picks the exterior wall; `coord` is the position along that
    wall's run (x for front/back, z for left/right). The frame sits a flat 6cm
    proud of the wall's outer face and the glass a further 3cm clear of the
    frame, so no two surfaces share an exactly coincident plane."""
    kids = []
    y = sill_y + h / 2
    frame_t, glass_t, standoff, clearance = 0.10, 0.02, 0.06, 0.03
    if side in ('front', 'back'):
        outward = 1 if side == 'front' else -1
        frame_axis = outward * (faces['front'] + standoff)
        glass_axis = frame_axis + outward * (frame_t / 2 + clearance + glass_t / 2)
        add_box_node(b, f'{name}_Frame', mats['frame'], (w + 0.16, h + 0.16, frame_t),
                     (coord, y, frame_axis), parent_children=kids)
        add_box_node(b, f'{name}_Glass', mats['glass'], (w - 0.08, h - 0.08, glass_t),
                     (coord, y, glass_axis), parent_children=kids)
    else:
        outward = 1 if side == 'right' else -1
        frame_axis = outward * (faces['side'] + standoff)
        glass_axis = frame_axis + outward * (frame_t / 2 + clearance + glass_t / 2)
        add_box_node(b, f'{name}_Frame', mats['frame'], (frame_t, h + 0.16, w + 0.16),
                     (frame_axis, y, coord), parent_children=kids)
        add_box_node(b, f'{name}_Glass', mats['glass'], (glass_t, h - 0.08, w - 0.08),
                     (glass_axis, y, coord), parent_children=kids)
    return add_empty_node(b, name, children=kids)


def add_porch(b, mats, children, spec, faces):
    """Full-width covered porch: deck, tapered column piers, header beam, and a
    shed roof. Deliberately mapped onto existing material slots rather than new
    ones — deck reads as MAT_Foundation, posts and beam as MAT_Trim, roof as
    MAT_Roofing — so recolouring Trim in the UI repaints the porch too."""
    p = spec['porch']
    width = spec['width']
    z_in = faces['front'] - 0.1
    z_out = z_in + p['depth']
    beam_z = z_out - 0.28

    add_box_node(b, 'Porch_Deck', mats['foundation'], (width + 0.5, 0.3, p['depth'] + 0.2),
                 (0, -0.11, (z_in + z_out) / 2), parent_children=children)
    add_box_node(b, 'Porch_Step', mats['foundation'], (2.6, 0.16, 0.42),
                 (spec['door']['x'], -0.14, z_out + 0.22), parent_children=children)

    pier_h, col_h = 0.85, p['roof_y'] - 0.85 - 0.32
    for i, cx in enumerate(p['columns'], start=1):
        add_box_node(b, f'Porch_Pier_{i:02d}', mats['trim'], (0.40, pier_h, 0.40),
                     (cx, 0.04 + pier_h / 2, beam_z), parent_children=children)
        add_box_node(b, f'Porch_Column_{i:02d}', mats['trim'], (0.24, col_h, 0.24),
                     (cx, 0.04 + pier_h + col_h / 2, beam_z), parent_children=children)
    add_box_node(b, 'Porch_Beam', mats['trim'], (width + 0.5, 0.30, 0.28),
                 (0, p['roof_y'] - 0.17, beam_z), parent_children=children)

    pitch = p['roof_pitch']
    run = (z_out + 0.3) - z_in
    drop = run * math.tan(math.radians(pitch))
    slope_len = run / math.cos(math.radians(pitch))
    add_box_node(b, 'Porch_Roof', mats['roof'], (width + 0.7, 0.12, slope_len),
                 (0, p['roof_y'] + drop / 2, z_in + run / 2), rotation_deg=(pitch, 0, 0),
                 parent_children=children)
    add_box_node(b, 'Porch_Fascia', mats['trim'], (width + 0.7, 0.16, 0.14),
                 (0, p['roof_y'] - 0.04, z_out + 0.3), parent_children=children)


def build(spec):
    b = Builder()
    width, depth, wall_h = spec['width'], spec['depth'], spec['wall_h']
    overhang, pitch, ridge_axis = spec['overhang'], spec['pitch'], spec['ridge_axis']

    # Windows/doors sit against the wall's actual OUTER face, not the
    # centreline — using depth/2 put their frames inside the wall volume,
    # coincident with the siding and z-fighting against it.
    faces = {'front': depth / 2 + WALL_T / 2, 'side': width / 2 + WALL_T / 2}

    mats = {
        'siding': b.get_material('MAT_Siding', (0.83, 0.80, 0.72), roughness=0.9),
        'roof': b.get_material('MAT_Roofing', (0.16, 0.16, 0.17), roughness=0.75),
        'trim': b.get_material('MAT_Trim', (0.92, 0.92, 0.90), roughness=0.55),
        'foundation': b.get_material('MAT_Foundation', (0.55, 0.54, 0.52), roughness=0.95),
        'frame': b.get_material('MAT_WindowFrame', (0.95, 0.95, 0.94), roughness=0.4),
        'glass': b.get_material('MAT_WindowGlass', (0.55, 0.65, 0.68), roughness=0.05, alpha=0.35),
        'slab': b.get_material('MAT_DoorSlab', (0.30, 0.14, 0.11), roughness=0.5),
        'dglass': b.get_material('MAT_DoorGlass', (0.55, 0.65, 0.68), roughness=0.05, alpha=0.35),
        'hardware': b.get_material('MAT_DoorHardware', (0.72, 0.64, 0.42), roughness=0.35, metallic=0.9),
    }

    body = []
    add_box_node(b, 'Body_Front', mats['siding'], (width, wall_h, WALL_T), (0, wall_h / 2, depth / 2), parent_children=body)
    add_box_node(b, 'Body_Back', mats['siding'], (width, wall_h, WALL_T), (0, wall_h / 2, -depth / 2), parent_children=body)
    add_box_node(b, 'Body_Left', mats['siding'], (WALL_T, wall_h, depth), (-width / 2, wall_h / 2, 0), parent_children=body)
    add_box_node(b, 'Body_Right', mats['siding'], (WALL_T, wall_h, depth), (width / 2, wall_h / 2, 0), parent_children=body)
    body_grp = add_empty_node(b, 'Body', children=body)

    # Top face sits 4cm ABOVE y=0 so it interpenetrates the wall/door bottoms
    # instead of sharing an exactly coincident plane with them.
    found = []
    add_box_node(b, 'Foundation', mats['foundation'], (width + 0.3, 0.54, depth + 0.3),
                 (0, -0.23, 0), parent_children=found)
    found_grp = add_empty_node(b, 'Foundation_Group', children=found)

    roof = []
    ridge_span = width if ridge_axis == 'x' else depth
    run_span = depth if ridge_axis == 'x' else width
    ridge_y, half_run, tv, extent = add_gable_roof(
        b, mats, roof, 'Roof', ridge_axis, ridge_span, run_span, wall_h, pitch, overhang)
    roof_grp = add_empty_node(b, 'Roof', children=roof)

    trim = []
    add_eave_fascia(b, mats, trim, 'Trim', ridge_axis, wall_h, half_run, tv, extent)
    for cx in (-width / 2, width / 2):
        for cz in (-depth / 2, depth / 2):
            tag = ('L' if cx < 0 else 'R') + ('B' if cz < 0 else 'F')
            add_box_node(b, f'Trim_CornerBoard_{tag}', mats['trim'], (0.22, wall_h, 0.22),
                         (cx, wall_h / 2, cz), parent_children=trim)
    if spec.get('belt_y'):
        add_box_node(b, 'Trim_BeltCourse', mats['trim'], (width + 0.26, 0.22, depth + 0.26),
                     (0, spec['belt_y'], 0), parent_children=trim)
    trim_grp = add_empty_node(b, 'Trim', children=trim)

    windows = []
    counters = {}
    for side, coord, sill, w, h in spec['windows']:
        counters[side] = counters.get(side, 0) + 1
        name = f'Window_{side.capitalize()}_{counters[side]:02d}'
        windows.append(add_window(b, mats, name, side, coord, sill, w, h, faces))
    windows_grp = add_empty_node(b, 'Windows', children=windows)

    d = spec['door']
    dx, dw, dh = d['x'], d['w'], d['h']
    cz = faces['front'] + 0.06
    doors = []
    # The slab is 0.08 thick, so its outer face is at cz+0.04 — glass and
    # hardware must clear that by more than a hair or they land on the same
    # plane as the slab face and z-fight.
    add_box_node(b, 'Door_Front_Slab', mats['slab'], (dw, dh, 0.08), (dx, dh / 2, cz), parent_children=doors)
    add_box_node(b, 'Door_Front_Glass', mats['dglass'], (dw * 0.34, dh * 0.32, 0.02),
                 (dx, dh * 0.70, cz + 0.07), parent_children=doors)
    add_box_node(b, 'Door_Front_Hardware', mats['hardware'], (0.05, 0.05, 0.06),
                 (dx + dw / 2 - 0.12, dh * 0.47, cz + 0.08), parent_children=doors)
    add_box_node(b, 'Door_Front_Trim', mats['trim'], (dw + 0.24, dh + 0.16, 0.10),
                 (dx, dh / 2, cz - 0.05), parent_children=doors)
    door_grp = add_empty_node(b, 'Door_Front', children=doors)
    doors_grp = add_empty_node(b, 'Doors', children=[door_grp])

    extras = []
    if spec.get('porch'):
        add_porch(b, mats, extras, spec, faces)
    extras_grp = add_empty_node(b, 'Porch', children=extras) if extras else None

    anchor = add_empty_node(b, 'Ground_Anchor', position=(0, 0, 0))

    root_children = [body_grp, found_grp, roof_grp, trim_grp, windows_grp, doors_grp]
    if extras_grp is not None:
        root_children.append(extras_grp)
    root_children.append(anchor)
    root = add_empty_node(b, 'House_Root', children=root_children)

    gltf = GLTF2(
        asset=Asset(generator=f"Northern Pines house generator ({spec['id']})", version='2.0'),
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
    return gltf, ridge_y


# ---------------------------------------------------------------------------
# The three demo homes. Window tuples are (side, coord, sill_y, width, height).
# ---------------------------------------------------------------------------

RANCH = {
    'id': 'ranch',
    'width': 11.5, 'depth': 7.0, 'wall_h': 2.8,
    'pitch': 22, 'overhang': 0.4, 'ridge_axis': 'x',
    'door': {'x': 3.0, 'w': 1.0, 'h': 2.05},
    'windows': [
        ('front', -4.3, 1.0, 1.15, 1.25),
        ('front', -2.7, 1.0, 1.15, 1.25),
        ('front', -0.2, 0.85, 2.40, 1.50),
        ('front', 4.6, 1.0, 1.15, 1.25),
        ('back', -3.6, 1.0, 1.15, 1.25),
        ('back', 0.0, 1.0, 1.80, 1.30),
        ('back', 3.6, 1.0, 1.15, 1.25),
        ('left', -2.0, 1.0, 1.00, 1.15),
        ('left', 1.6, 1.0, 1.00, 1.15),
        ('right', -2.0, 1.0, 1.00, 1.15),
        ('right', 1.6, 1.0, 1.00, 1.15),
    ],
}

COLONIAL = {
    'id': 'colonial',
    'width': 9.6, 'depth': 8.0, 'wall_h': 5.6,
    'pitch': 34, 'overhang': 0.35, 'ridge_axis': 'x',
    'belt_y': 2.86,
    'door': {'x': 0.0, 'w': 1.05, 'h': 2.10},
    'windows': [
        # ground floor — symmetric about the centred entry, with sidelights
        ('front', -0.82, 0.16, 0.32, 1.90),
        ('front', 0.82, 0.16, 0.32, 1.90),
        ('front', -1.95, 0.95, 1.15, 1.30),
        ('front', 1.95, 0.95, 1.15, 1.30),
        ('front', -3.50, 0.95, 1.15, 1.30),
        ('front', 3.50, 0.95, 1.15, 1.30),
        # upper floor — five bays, the classic colonial rhythm
        ('front', 0.0, 3.75, 1.15, 1.30),
        ('front', -1.95, 3.75, 1.15, 1.30),
        ('front', 1.95, 3.75, 1.15, 1.30),
        ('front', -3.50, 3.75, 1.15, 1.30),
        ('front', 3.50, 3.75, 1.15, 1.30),
        ('back', -3.2, 0.95, 1.15, 1.30),
        ('back', -1.1, 0.95, 1.15, 1.30),
        ('back', 1.1, 0.95, 1.60, 1.30),
        ('back', 3.2, 0.95, 1.15, 1.30),
        ('back', -3.2, 3.75, 1.15, 1.30),
        ('back', -1.1, 3.75, 1.15, 1.30),
        ('back', 1.1, 3.75, 1.15, 1.30),
        ('back', 3.2, 3.75, 1.15, 1.30),
        ('left', -2.2, 0.95, 1.05, 1.25),
        ('left', 1.4, 0.95, 1.05, 1.25),
        ('left', -2.2, 3.75, 1.05, 1.25),
        ('left', 1.4, 3.75, 1.05, 1.25),
        ('right', -2.2, 0.95, 1.05, 1.25),
        ('right', 1.4, 0.95, 1.05, 1.25),
        ('right', -2.2, 3.75, 1.05, 1.25),
        ('right', 1.4, 3.75, 1.05, 1.25),
    ],
}

CRAFTSMAN = {
    'id': 'craftsman',
    'width': 10.0, 'depth': 8.0, 'wall_h': 3.0,
    # Ridge along Z means the gable faces the street — the single strongest
    # visual difference from the two side-gable homes above.
    'pitch': 24, 'overhang': 0.6, 'ridge_axis': 'z',
    'door': {'x': 1.2, 'w': 1.05, 'h': 2.10},
    'porch': {'depth': 2.4, 'roof_y': 2.75, 'roof_pitch': 12,
              'columns': [-4.4, -1.6, 1.6, 4.4]},
    'windows': [
        ('front', -2.2, 0.75, 2.60, 1.55),
        ('front', 3.7, 0.85, 1.20, 1.35),
        ('front', 0.0, 4.00, 1.00, 0.95),   # attic light in the front gable
        ('back', -3.0, 1.0, 1.30, 1.35),
        ('back', 0.6, 1.0, 1.60, 1.35),
        ('back', 3.4, 1.0, 1.10, 1.30),
        ('back', 0.0, 4.00, 1.00, 0.95),
        ('left', -2.4, 1.0, 1.15, 1.30),
        ('left', 1.4, 1.0, 1.15, 1.30),
        ('right', -2.4, 1.0, 1.15, 1.30),
        ('right', 1.4, 1.0, 1.15, 1.30),
    ],
}

HOUSES = [RANCH, COLONIAL, CRAFTSMAN]


if __name__ == '__main__':
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for spec in HOUSES:
        gltf, ridge_y = build(spec)
        out = os.path.join(here, f"house-{spec['id']}.glb")
        gltf.save_binary(out)
        size = os.path.getsize(out)
        print(f"wrote {os.path.basename(out)}  "
              f"{spec['width']}x{spec['depth']}m  ridge {ridge_y:.2f}m  {size/1024:.1f} KB")
