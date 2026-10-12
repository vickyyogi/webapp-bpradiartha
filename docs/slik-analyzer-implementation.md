# Implementasi Analisa SLIK OJK (IDEB)

Catatan implementasi atas spesifikasi di [`docs/slik-analyzer.md`](./slik-analyzer.md).
Spesifikasi tersebut sudah diimplementasikan, namun sebagian detail teknisnya diubah
(alasannya ada di bagian [Penyimpangan dari spesifikasi](#penyimpangan-dari-spesifikasi)).

## Alur sistem

```
[Analis Kredit]                [Server Next.js]                          [OpenRouter]
      |                               |                                        |
      |-- unggah 1..10 PDF ---------> |                                        |
      |                               |-- pdf-parse-fork: ekstrak teks lokal -->|
      |                               |   (PDF TIDAK dikirim ke luar)          |
      |                               |-- POST /api/analyze-slik ------------->|
      |                               |    prompt + skema JSON wajib            |
      |                               | <---- JSON murni (tanpa backtick) ------|
      |                               |-- normalisasi + validasi runtime ------|
      | <-- data JSON terstruktur ----|                                        |
      |-- koreksi manual (opsional) -->|                                        |
      |-- Unduh Laporan PDF --------> jsPDF + autotable (di browser)            |
```

Rincian laporan PDF selalu dibuat di sisi klien; server hanya mengembalikan data JSON,
sehingga tidak ada file PDF hasil yang perlu disimpan di server.

## Peta berkas

| Berkas | Peran |
| --- | --- |
| `src/app/api/analyze-slik/route.ts` | Endpoint POST (analisa) & GET (info konfigurasi). Auth + RBAC + rate limit + audit log. Ekstraksi teks PDF di sini. |
| `src/lib/slik/openrouter.ts` | Prompt sistem, pemanggilan OpenRouter, fallback model, pembersihan JSON dari markdown. Server-only. |
| `src/lib/slik/types.ts` | Tipe skema + normalisasi/validasi runtime (`normalizeSlikAnalysis`) — dipakai server maupun klien. |
| `src/lib/slik/generateSlikReport.ts` | Generator laporan PDF 2 halaman (client-side, import jsPDF dinamis). |
| `src/app/(dashboard)/credit/slik-analyzer/page.tsx` | Halaman dashboard + gerbang permission. |
| `src/app/(dashboard)/credit/slik-analyzer/SlikAnalyzerClientView.tsx` | UI unggah, pratinjau hasil, koreksi JSON, unduh PDF. |
| `src/types/pdf-parse-fork.d.ts` | Deklarasi tipe untuk `pdf-parse-fork` (paket CJS tanpa tipe). |
| `scripts/verify-slik-*.ts` | Uji mandiri (`npm run verify:slik`). |

## Perilaku multi-berkas (penting)

Ada dua mode analisa, dipilih di UI dan dikirim sebagai field `mode` pada FormData:

**1. `per-file` (default) — satu berkas = satu debitur = satu laporan.**
Setiap PDF dikirim pada panggilan model tersendiri, menghasilkan satu objek JSON dan
satu laporan tersendiri. Kegagalan satu berkas tidak menggagalkan berkas lain: berkas
yang gagal tetap muncul di daftar hasil dengan alasannya. Maksimal 3 berkas dianalisa
bersamaan (sisanya menunggu), agar tidak membanjiri OpenRouter.
Fungsi: `analyzeSlikPerDocument()` di `openrouter.ts`.

**2. `merge` — semua berkas dianggap satu debitur.**
Teks seluruh berkas digabung (ditandai `===== DOKUMEN n: nama.pdf =====`) menjadi satu
prompt, dan model diminta menggabungkannya menjadi SATU objek JSON → satu laporan.
Dipakai bila satu IDEB terpecah menjadi beberapa PDF (mis. per halaman).

Konsekuensi yang harus disadari: pada mode `merge`, mengunggah laporan debitur berbeda
akan tercampur menjadi satu laporan. Untuk debitur berbeda, pakai mode `per-file`.

Response API mengikuti mode: `merge` mengembalikan `{ mode, data, meta }`, sedangkan
`per-file` mengembalikan `{ mode, results: [...], meta }` dengan satu entri per berkas.

## Ketahanan pembacaan PDF (penting)

Pustaka `pdf-parse-fork` (pdf.js 1.10.100) terbukti **gagal acak** pada berkas yang
sehat: dalam pengujian di mesin ini sekitar 1 dari 8 pembacaan berakhir
`bad XRef entry` / `Command token too long` / `Illegal character`, dan panggilan pertama
dalam satu proses paling sering gagal. Berkas yang sama berhasil pada percobaan
berikutnya, dan semua PDF uji terbaca normal di Chrome — jadi ini masalah pustaka, bukan
berkas rusak.

Karena itu semua pembacaan teks lewat satu helper, `extractPdfText()` di
`src/lib/slik/pdfText.ts`, yang mengulang pembacaan sampai 3 kali dengan salinan buffer
berukuran persis. Setelah perubahan ini 8/8 pembacaan berhasil pada berkas yang
sebelumnya gagal. Jangan memanggil `pdf-parse-fork` langsung dari route atau skrip baru —
pakai helper tersebut.

## Konfigurasi

Tambahkan ke `.env` lalu restart server:

```env
OPENROUTER_API_KEY="sk-or-v1-..."          # wajib
OPENROUTER_MODEL="qwen/qwen3.7-flash"       # opsional (default)
OPENROUTER_FALLBACK_MODEL="deepseek/deepseek-v4.1-flash"
OPENROUTER_TIMEOUT_MS="150000"              # opsional, batas waktu per percobaan model
SLIK_MAX_DOC_CHARS="220000"                 # opsional, batas total karakter teks per analisa
```

Hak akses memakai kode permission yang sudah ada, tanpa menambah katalog permission baru:

- `credit.analysis.create` → menjalankan analisa (POST).
- `credit.analysis.view` → membuka halaman & endpoint info (GET).

Role `CREDIT_ANALYST`, `ADMIN_OPERASIONAL`, dan `ADMIN` (super admin) sudah memiliki
permission tersebut dari seed RBAC. Menu muncul di **Kredit & Analisis → Analisa SLIK OJK**.

## Penyimpangan dari spesifikasi

1. **Lokasi & bahasa berkas.** Spesifikasi menulis `app/api/analyze-slik/route.js`;
   implementasi memakai `src/app/api/analyze-slik/route.ts` mengikuti struktur project
   (TypeScript, alias `@/`).
2. **Keamanan.** Spesifikasi tidak menyebut autentikasi. Ditambahkan
   `requireAuthAndPermission`, rate limit 6 analisa / 5 menit per IP, batas ukuran berkas,
   dan audit log (`entityType: SLIK_ANALYSIS`) karena endpoint ini memakai API key berbayar
   dan memproses data debitur.
3. **Tata letak PDF tidak memakai koordinat tetap.** Contoh pada spesifikasi mengunci
   posisi kotak peringatan di `finalY + 6` dan footer di `y = 288`, serta memakai ukuran
   kotak keputusan tetap 55 mm. Akibatnya laporan dengan banyak fasilitas atau uraian
   panjang akan menabrak footer/terpotong. Implementasi memakai alur bertingkat dengan
   pemantauan ruang sisa (`ensureSpace`), tabel yang boleh berpindah halaman, dan kotak
   keputusan yang diukur dulu lalu dipecah ke halaman berikutnya bila perlu.
4. **Nomor halaman dinamis.** Spesifikasi menulis "Halaman 1 dari 2"; implementasi
   menghitung jumlah halaman di akhir dan menulis "Halaman X dari Y".
5. **Validasi runtime.** Respons model tidak dipercaya begitu saja: semua nilai dipaksa ke
   tipe yang benar (`parseNumeric` memahami "Rp 1.500.000", "1.234,56", "12,5%"), array
   yang hilang menjadi `[]`, dan rekomendasi yang tidak dikenal diubah menjadi `REJECT`
   (pilihan paling konservatif). Setiap perbaikan dicatat sebagai peringatan yang tampil
   di UI.
6. **Multi-PDF & batas teks.** Maksimal 10 berkas PDF per analisa. Teks tiap berkas
   diekstrak terpisah lalu digabung dengan penanda `===== DOKUMEN n: nama.pdf =====`
   agar model tahu asal datanya. Kuota teks dijaga dua lapis: `MAX_CHARS_PER_DOC`
   (150.000 karakter per berkas) dan `SLIK_MAX_DOC_CHARS` (default 220.000 karakter
   **total** antar berkas, dieksekusi oleh `applyTextBudget`). Berkas yang teksnya
   dipotong atau tidak kebagian kuota dilaporkan sebagai peringatan di UI, tidak
   dibuang diam-diam.
7. **Server-side vs client-side.** jsPDF diimpor dinamis di klien sehingga tidak masuk
   bundel awal halaman.

## Menjalankan uji mandiri

```bash
npm run verify:slik        # tanpa jaringan (logika + tata letak PDF)
npm run verify:slik:live   # memanggil OpenRouter sungguhan (perlu API key, pakai token)
```

`verify:slik` menjalankan dua pemeriksaan:

1. `scripts/verify-slik-logic.ts` — 44 uji logika murni (parsing angka Indonesia,
   pembersihan JSON yang masih terbungkus pagar markdown, normalisasi hasil ekstraksi,
   dan penegakan kuota teks `applyTextBudget`). Tidak memanggil API.
2. `scripts/verify-slik-report.ts` — membuat laporan PDF dari data contoh dan data tekanan
   (34 fasilitas, uraian panjang), lalu memastikan tidak ada teks yang melewati batas area
   isi 282 mm dan membaca ulang PDF hasilnya dengan `pdf-parse-fork`.

`verify:slik:live` mengirim teks SLIK **sintetis** (bukan data debitur nyata) ke OpenRouter
dan memeriksa hasilnya: nama/NIK terbaca, nominal "Rp 150.000.000" menjadi angka, "45 hari"
menjadi 45, dan rekomendasi komite termasuk nilai yang diizinkan. Skrip ini melewati
pengujian dengan pesan jelas bila `OPENROUTER_API_KEY` belum diset.

Untuk memuat `.env` sebelum menjalankan uji live dari terminal:

```bash
set -a; . ./.env; set +a
npm run verify:slik:live
```

Skrip laporan menulis PDF hasil ke direktori `OUT_DIR` (default: direktori saat ini), mis.:

```bash
OUT_DIR="$HOME/Downloads" npm run verify:slik
```

## Batasan yang diketahui

- Analisa berjalan sinkron (tanpa streaming), jadi analis menunggu sampai selesai. Dari uji
  nyata dengan prompt ~1 KB dibutuhkan ~70 detik; berkas SLIK berukuran penuh bisa beberapa
  menit. Batas waktu per percobaan model ditetapkan 150 detik (`OPENROUTER_TIMEOUT_MS`) agar
  percobaan utama + cadangan tetap di bawah `maxDuration` route (300 detik). UI sudah
  menampilkan penghitung waktu selama proses.
- PDF hasil scan/gambar tidak punya lapisan teks: endpoint akan mengembalikan 422 dengan
  pesan agar berkas di-OCR terlebih dahulu.
- Hasil analisa belum disimpan ke database (hanya tercatat di audit log). Bila nanti perlu
  dilampirkan ke berkas pengajuan kredit, dokumen PDF-nya dapat diunggah lewat modul
  Dokumen Digital atau ditambahkan tabel penyimpanan tersendiri.
