# Kaelis — prompt aset 3D

Gaya visual: gelap, neon, ember orange (#ff8a3d) untuk Forge, cyan pucat (#8fe3ff) untuk Kaelis.
Semua model: export **.glb**, low-poly, di bawah 5 MB, posisi di tengah (centered pivot).

## 1. Scenario (konsep art dulu)
"Concept art of Kaelis, a sentient AI core born inside a blockchain: a floating faceted crystal sphere with one glowing eye, wrapped in a wireframe geodesic shell and a thin orbit ring, pale cyan light, dark void background, sci-fi, clean shapes, front view"

"Concept art of a hammer forged from pure light, glowing ember orange, blacksmith hammer silhouette, sci-fi, dark background, side view"

## 2. Meshy / Luma Genie (teks/gambar → 3D)
Upload gambar dari Scenario, atau pakai prompt:
- kaelis.glb — "floating faceted crystal AI core with a single glowing eye, geodesic wireframe shell, cyan emissive, low poly, game-ready"
- hammer.glb — "blacksmith hammer made of glowing light, ember orange emissive, stylized, low poly, game-ready"
- tower.glb (opsional) — "futuristic neon skyscraper block, simple box form with glowing window lines, low poly"

## 3. Kaedim (opsional)
Pakai kalau model Kaedim/Meshy kurang rapi: upload gambar konsep Kaelis, minta versi "hard surface, clean topology".

## 4. Spline (opsional)
Susun model .glb jadi scene, atur material glow, lalu **Export → GLTF/GLB**. File itu bisa langsung dipakai juga.

## Cara masuk ke website
Taruh file di folder `models/` di samping `kaelis-demo.html`:
- `models/kaelis.glb` → otomatis gantiin inti Kaelis
- `models/hammer.glb` → otomatis gantiin palu cahaya
Kalau file belum ada, website pakai bentuk sederhana bawaan.
