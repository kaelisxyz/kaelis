# Kaelis: Flow Project Lengkap

2026-11-05 · brokie
Sumber: https://claude.ai/artifact/JPbAyyU6qUptYkQMY7r6ng

## Gambaran besar

Kaelis ($KAEL) itu AI agent yang ngecek token Solana sebelum orang beli, dan nantinya ngasih hadiah ke builder yang beneran ngoding. Per hari ini, Scanner dan Menara Holder udah jalan pakai data Solana asli; Proof-of-Build dan Forge City masih data contoh.

| Bagian | Status | Halaman |
|---|---|---|
| Scanner token (8 cek + tes jual + lacak wallet + mode pantau) | Live, data asli | scan.html |
| Menara holder $KAEL | Siap, nyala begitu mint diisi | tower.html |
| Penjelasan AI + API server | Kode siap, nyala begitu key + Railway | /api/scan |
| Guide cara pakai + detail tech | Live | guide.html |
| Home: cerita 3D + simulasi "Try it" | Live (simulasi pakai contoh) | index.html |
| Forge City | Demo, data contoh | city.html |
| Proof-of-Build (hadiah buat builder) | Belum dibuat | - |

Kode ada di repo kaelisxyz/kaelis (commit terakhir 33eb85c).

## Flow pengunjung di website

Pengunjung masuk dari Home, ngerti ceritanya, nyoba simulasi, lalu pindah ke Scanner buat ngecek token asli.

1. **Home (index.html)**: wordmark KAELIS 3D hitam putih, tombol Forge City di bawahnya, switch Built/Blueprint di header, plus Scanner, Guide, X dan Buy.
2. **Scroll cerita**: blok pertama, chain, kota, lalu Kaelis jaga kota.
3. **Tiga fitur** (Builders, Scam scanner, A light in the tower), masing-masing ada link ke halaman aslinya.
4. **Try it**: simulasi kecil Scan, Build, Hold pakai contoh, biar orang ngerti dalam beberapa detik.
5. **Scanner (scan.html)**: tempel alamat token, dapet skor 0 sampai 100 plus bukti.
6. **Menara (tower.html)**: lihat jendela holder, cari jendela sendiri pakai alamat wallet.
7. **Guide (guide.html)**: video agent 36 detik, cara pakai 3 langkah, detail tech, kalkulator risiko, roadmap.
8. **Forge City (city.html)**: kota 3D, sekarang masih contoh.

## Flow scanner

Satu scan baca 6 sumber data barengan, jalanin 8 cek dengan bobot total 100, terus kasih skor, label, ringkasan, dan bukti. Semua aturannya ada di satu file, site/js/kaelis-core.js (rules v1.1.1), dipakai website dan API, jadi hasilnya selalu sama.

Empat sumber dibaca barengan, delapan cek jadi satu skor, lalu tiga langkah lanjutan jalan dari skor itu. *(Diagram alur ada di dokumen aslinya.)*

**Data yang dibaca:** info mint, supply dan 20 akun terbesar (Solana RPC), pool dan transaksi 24 jam (DexScreener), LP terkunci dan flag tambahan (RugCheck), harga beli 0.1 SOL lalu jual balik (Jupiter, cuma minta harga, nggak transaksi).

| Cek | Bobot | Kapan dianggap bahaya |
|---|---|---|
| Tes jual | 25 | Nggak bisa jual balik atau rugi 50% ke atas. Ini hard flag: skor minimal 85 |
| Likuiditas | 15 | Di bawah $5k bahaya penuh, di atas $250k aman |
| 10 holder terbesar | 15 | Pegang 30% sampai 80% supply, pool nggak dihitung |
| LP terkunci | 15 | Bagian LP yang nggak dikunci atau dibakar |
| Mint authority | 10 | Masih ada yang bisa cetak token baru |
| Kontrol Token-2022 | 10 | Permanent delegate, nggak bisa ditransfer, transfer hook, fee transfer |
| Umur pool | 5 | Di bawah 1 hari bahaya penuh, di atas 30 hari aman |
| Freeze authority | 5 | Masih ada yang bisa bekuin token holder |

Label: 0 sampai 39 risiko rendah, 40 sampai 69 mencurigakan, 70 ke atas bahaya. Cek yang datanya nggak kebaca ditulis "n/a" dan nggak nambah skor; ringkasannya bilang skor bisa lebih rendah dari risiko asli.

**Habis skor keluar:**

- **Lacak wallet (deep scan):** buat 10 wallet terbesar, Kaelis cari transaksi pertama yang ngisi dana wallet itu. Kalau beberapa wallet dananya dari sumber yang sama, ditandai sebagai kemungkinan satu orang (bundle atau sniper), lengkap dengan link transaksinya. Belum masuk skor.
- **Mode pantau:** tombol "Watch this token" scan ulang tiap 60 detik selama tab kebuka. Ada peringatan kalau likuiditas turun lebih dari 50%, mint atau freeze authority nyala lagi, atau skor gerak 10 poin.

## Flow backend dan AI

Scanner punya dua mode dan milih sendiri: kalau server Kaelis jawab, scan lewat server; kalau nggak, scan langsung di browser pengunjung. Jadi website tetap jalan walau belum ada key apa pun.

1. Halaman scan cek /api/health sekali.
2. **Belum deploy atau di localhost:** /api nggak ada, jadi browser scan sendiri pakai RPC publik gratis. Nggak ada penjelasan AI.
3. **Udah di Railway:** browser panggil /api/scan?mint=...
   1. Server pakai Helius kalau HELIUS_RPC_URL diisi (lebih cepat, jarang gagal), kalau nggak pakai RPC publik.
   2. Hasil disimpan 60 detik, jadi 100 orang scan token yang sama cuma 1 kali kerja.
   3. Batas 20 scan per menit per pengunjung.
   4. Server jalanin 8 cek yang sama plus lacak wallet.
   5. Kalau ANTHROPIC_API_KEY diisi, hasil cek dikirim ke Claude buat ditulis jadi 3 sampai 5 kalimat biasa.
   6. Setiap angka di jawaban AI dicocokin sama data cek. Ada angka karangan, jawabannya dibuang dan yang tampil ringkasan dari aturan.
4. Kalau server error, halaman otomatis balik ke mode browser.

AI cuma menjelaskan, nggak bisa ngubah skor. Model default claude-opus-5-5, bisa diganti lewat KAELIS_MODEL. Endpoint lain: /api/holders (daftar holder) dan /api/health (bagian mana yang udah nyala, key nggak pernah ditampilkan).

## Flow menara holder

Setiap wallet yang pegang $KAEL dapet satu jendela nyala di tower.html, dibaca langsung dari chain; jual semua, jendelanya mati di refresh berikutnya.

1. Halaman baca mint $KAEL dari site/js/kaelis-config.js. Masih kosong, jadi sekarang tampil 41 jendela contoh dengan label "Goes live at launch".
2. Setelah mint diisi, halaman minta daftar holder ke /api/holders. Dengan Helius, semua akun token dibaca dan digabung per pemilik (sampai 1.000 jendela).
3. Tanpa server atau Helius, halaman cuma bisa baca 20 akun terbesar dari RPC publik, dan bilang begitu di catatan bawah.
4. Posisi jendela diurut berdasarkan alamat wallet, jadi tiap orang dapet posisi yang sama tiap buka.
5. Pengunjung tempel alamat wallet, halaman cek saldo $KAEL wallet itu, terus jendelanya nyala biru.
6. Data di-refresh tiap 2 menit.

Bisa dicoba sekarang pakai token apa aja: `tower.html?mint=<alamat token>`.

## Flow kerja (cara perubahan sampai ke lu)

Lu minta di chat, gua ubah dan tes di cloud, PC lu yang push ke GitHub, dan localhost lu update sendiri dalam 30 detik.

1. Lu kirim permintaan di thread ini (teks, screenshot, atau rekaman layar).
2. Gua edit file di cloud, terus tes pakai browser otomatis dan data tiruan (cloud nggak bisa nyambung ke Solana).
3. Gua commit, terus titip paket repo ke folder project.
4. Sesi di PC lu (pensht) ambil paket itu dan push ke kaelisxyz/kaelis.
5. PC lu narik update dari GitHub tiap 30 detik ke C:\Users\user\Downloads\kaelis-live\site, dan nyajiin di http://localhost:5173.
6. Gua juga update preview online (artifact) biar bisa lu buka dari HP.

Kalau PC lu mati atau sleep, langkah 4 dan 5 berhenti dan jalan lagi begitu PC nyala dan Claude kebuka. Tes pakai token asli harus jalan di PC lu, bukan di cloud.

## Flow launch

Urutannya: tes scanner pakai token asli dulu, terus online-in website, baru launch coin dan nyalain menara holder. Nggak ada yang perlu bayar sampai langkah AI.

**Sebelum launch**

- [ ] Tes scanner di localhost:5173/scan.html pakai USDC, BONK, JUP, plus 1 token pump baru. Hasilnya harus masuk akal: USDC dan BONK rendah, token baru lebih tinggi.
- [ ] Kasih link akun X buat ikon X di header (sekarang masih kosong).
- [ ] Deploy repo ke Railway: New Project, Deploy from GitHub repo, pilih kaelisxyz/kaelis. Settingan udah ada di railway.json dan server.js.
- [ ] Bikin key Helius gratis, masukin sebagai HELIUS_RPC_URL di tab Variables Railway.
- [ ] Opsional: bikin key Anthropic, masukin sebagai ANTHROPIC_API_KEY buat penjelasan AI. Ini berbayar per scan; bisa pakai model lebih murah lewat KAELIS_MODEL.
- [ ] Buka /api/health di website online, pastiin bagian yang lu isi kebaca "true".

**Pas dan sesudah launch**

- [ ] Isi mint $KAEL di KAEL_MINT (Railway) dan kaelMint di site/js/kaelis-config.js. Bilang ke gua, nanti gua yang ubah.
- [ ] Cek tower.html nyala dan jumlah holder masuk akal.
- [ ] Scan $KAEL sendiri di scanner. Orang bakal ngelakuin ini, jadi pastiin mint dan freeze authority udah dicabut dan LP dikunci.

## Yang belum jadi

Tiga hal masih contoh atau rencana, dan website udah nulis jujur statusnya.

1. **Lacak wallet masuk skor (rules v1.2):** nunggu hasil tes token asli dulu biar batasnya nggak asal.
2. **Proof-of-Build:** hubungin akun kode + wallet, cek kode yang beneran di-merge tiap minggu, bagi hadiah $KAEL. Perlu backend dan database sendiri.
3. **Forge City pakai data asli:** gedung dari builder beneran dan token yang di-scan orang.

Bot Telegram udah dicoret sesuai permintaan lu.
