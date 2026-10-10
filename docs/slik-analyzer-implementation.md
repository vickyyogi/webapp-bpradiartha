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

## Konfigurasi

Tambahkan ke `.env` lalu restart server:

```env
OPENROUTER_API_KEY="sk-or-v1-..."          # wajib
OPENROUTER_MODEL="qwen/qwen3.7-flash"       # opsional (default)
OPENROUTER_FALLBACK_MODEL="deepseek/deepseek-v4.1-flash"
SLIK_MAX_DOC_CHARS="220000"                 # opsional, batas teks per analisa
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
6. **Multi-PDF.** Teks tiap berkas digabung dengan penanda `===== DOKUMEN n: nama.pdf =====`
   agar model tahu asal datanya, dan dibatasi `SLIK_MAX_DOC_CHARS` agar biaya/konteks tetap wajar.
7. **Server-side vs client-side.** jsPDF diimpor dinamis di klien sehingga tidak masuk
   bundel awal halaman.

## Menjalankan uji mandiri

```bash
npm run verify:slik
```

Menjalankan dua pemeriksaan:

1. `scripts/verify-slik-logic.ts` — 32 uji logika murni (parsing angka Indonesia,
   pembersihan JSON yang masih terbungkus pagar markdown, normalisasi hasil ekstraksi).
   Tidak memanggil API.
2. `scripts/verify-slik-report.ts` — membuat laporan PDF dari data contoh dan data tekanan
   (34 fasilitas, uraian panjang), lalu memastikan tidak ada teks yang melewati batas area
   isi 282 mm dan membaca ulang PDF hasilnya dengan `pdf-parse-fork`.

Skrip kedua menulis PDF hasil ke direktori `OUT_DIR` (default: direktori saat ini), mis.:

```bash
OUT_DIR="$HOME/Downloads" npm run verify:slik
```

## Batasan yang diketahui

- Panggilan OpenRouter sungguhan belum diuji karena `OPENROUTER_API_KEY` belum tersedia
  saat implementasi. Semua logika di sekitarnya (ekstraksi, normalisasi, pembuatan PDF,
  gerbang RBAC) sudah diuji.
- PDF hasil scan/gambar tidak punya lapisan teks: endpoint akan mengembalikan 422 dengan
  pesan agar berkas di-OCR terlebih dahulu.
- Hasil analisa belum disimpan ke database (hanya tercatat di audit log). Bila nanti perlu
  dilampirkan ke berkas pengajuan kredit, dokumen PDF-nya dapat diunggah lewat modul
  Dokumen Digital atau ditambahkan tabel penyimpanan tersendiri.
