# Kaelis — project brief (sementara)

- Nama project/coin: **Kaelis** ($KAEL) — nama sementara, bisa diganti.
- Meta: AI agents (target global, website bahasa Inggris).
- Builder: solo dev, bagian "Builder" menggantikan "Team".
- GitHub & Railway: akun khusus Kaelis (mis. kaelisxyz), token di `.env.personal`. Push hanya lewat `scripts/push.sh`. Tidak ada hubungan dengan akun reppurn.

## Lore gabungan: Genesis Forge + Signal from the Mempool
Dunia digital awalnya gelap dan kacau. Para developer ("Forgers") menempa blok demi blok
sampai terbentuk kota neon on-chain. Saat kota itu menyala, dari Mempool di bawahnya muncul
sinyal: Kaelis, AI agent pertama yang lahir dari data chain. Kaelis butuh energi ($KAEL)
untuk tumbuh, dan memanggil para Forgers/Builders untuk membangun bersamanya.

Tagline: "Forged by builders. Awakened by the chain."  (alt: "The chain is alive. Answer the signal.")

## Narasi scroll (6 adegan)
1. Chaos — layar gelap, partikel acak.
2. The First Block — palu cahaya menempa kubus pertama.
3. The Chain — kubus-kubus tersambung garis cahaya.
4. The City — kubus naik jadi kota neon.
5. The Signal — Kaelis (inti cahaya) bangun dari Mempool di bawah kota; kursor diikuti Kaelis.
6. Join the Forge — utilitas $KAEL, tokenomics, Builder, CTA Buy/Join.

Visual: palu cahaya, kubus menyatu jadi chain, kota neon, inti AI bercahaya.
Tech: Three.js/R3F + GSAP ScrollTrigger (atau Spline).

## Keputusan desain
- Versi utama: demo neon scroll (kaelis-demo.html, https://claude.ai/artifact/FqrnBmCrMZ6MwTrmTZFFhn).
- Versi clay/minimal (kaelis-clay.html) dicoba tapi user lebih suka yang neon.

## Konsep produk: The Forge City (disukai user)
Kota 3D neon yang hidup, jadi produk utama (bukan cuma hiasan).
- Distrik Builder: developer login GitHub + wallet, dapat 1 gedung. Commit/project nyata diverifikasi Kaelis → gedung naik + dapat $KAEL (Proof-of-Build). Gedung aktif terang, tidak aktif redup. Risiko: commit palsu, perlu anti-curang.
- Distrik Scan: tiap token yang dicek Kaelis jadi gedung. Skor risiko 0–100 dari red flags (dev holding besar, LP tidak dikunci, mint authority aktif, honeypot via GoPlus/RugCheck, riwayat dev, holder palsu). Aman = kokoh, curiga = retak merah, rug = runtuh ke "kuburan scam".
- Holder: tiap pemegang $KAEL = 1 jendela menyala di menara utama Kaelis; holder besar dapat rumah di distrik holder; jual semua = lampu mati.
- Kaelis terbang keliling kota sebagai penjaga, umumkan builder terbaik mingguan.
- Saran urutan: bikin produk/bot dulu, tes 20–50 user gratis, baru launch $KAEL.
- Demo Forge City: forge-city.html, https://claude.ai/artifact/AfVuqenBWMrNAF4qbr2T27
