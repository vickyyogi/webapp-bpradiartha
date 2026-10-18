# Pemetaan Data ke Penyedia AI (OpenRouter) — Analisa SLIK OJK

**Status:** Tahap 5A (P0.5) — dokumentasi kewajiban *"Data yang dikirim ke penyedia eksternal terdokumentasi"*.
Dokumen ini menjelaskan PERSIS apa yang keluar dari sistem saat fitur Analisa SLIK OJK dipakai.

## 1. Alur data

```
PDF SLIK OJK (unggahan pengguna)
  → ekstraksi teks LOKAL (src/lib/slik/pdfText.ts, pdf-parse-fork — TANPA pihak ketiga)
  → teks hasil ekstraksi (dibatasi kuota karakter)
  → HTTPS POST ke OpenRouter (https://openrouter.ai/api/v1/chat/completions)
  → respons JSON → dinormalisasi (src/lib/slik/types.ts) → disimpan ke database
     (tabel slik_analysis_records, terkait debitur terpilih)
```

## 2. Yang DIKIRIM ke OpenRouter

| Isi | Rincian |
|---|---|
| **System prompt** | Prompt statis berbahasa Indonesia berisi skema JSON output + aturan ekstraksi (`SLIK_SYSTEM_PROMPT` di `src/lib/slik/openrouter.ts`). Tidak memuat data nasabah. |
| **User prompt** | **Teks hasil ekstraksi PDF SLIK** apa adanya, dibungkus penanda nama berkas + jumlah halaman. Teks ini memuat data dalam laporan SLIK: nama, NIK, TTL, pekerjaan, alamat, daftar fasilitas kredit (bank, plafon, baki debet, kolektibilitas, tunggakan), dan catatan lain yang tercetak pada dokumen. |
| **Parameter model** | `model`, `temperature: 0.1`, `response_format: json_object`. |
| **Header identitas aplikasi** | `HTTP-Referer` (URL aplikasi) dan `X-Title` ("BPR Adiartha - SLIK OJK Analyzer") — untuk atribusi OpenRouter, bukan data nasabah. |

### Batas pengiriman
- Teks per berkas dipotong maksimal **150.000 karakter** (`MAX_CHARS_PER_DOC`, turunan dari `SLIK_MAX_DOC_CHARS`).
- Mode gabung: total antar berkas maksimal **220.000 karakter** (`MAX_PROMPT_DOC_CHARS`) — dokumen yang tidak kebagian kuota dilaporkan sebagai peringatan, bukan diam-diam hilang.
- Maksimal **10 berkas** per analisa; 15 MB per berkas; 40 MB total.

## 3. Yang TIDAK dikirim

- **Berkas PDF biner** — hanya teks hasil ekstraksinya.
- Data dari database (data nasabah lain, pegawai, pengajuan kredit, dokumen lain) — pemilihan debitur hanya dipakai di server untuk keterkaitan penyimpanan, **tidak ikut** dalam prompt.
- Kredensial pengguna, token sesi, atau data autentikasi apa pun.
- Hasil analisa sebelumnya.

## 4. Model & tujuan pemrosesan

| Model | Peran |
|---|---|
| `OPENROUTER_MODEL` (default `qwen/qwen3.7-flash`) | Model utama |
| `OPENROUTER_FALLBACK_MODEL` (default `deepseek/deepseek-v4.1-flash`) | Cadangan bila model utama gagal |

Tujuan: **ekstraksi struktur + ringkasan analitis** dari laporan SLIK OJK (IDEB) untuk membantu analis kredit.
Output AI adalah **alat bantu analisis, bukan keputusan kredit final** — ditegaskan di UI dan laporan.

## 5. Kontrol yang berlaku

- **Izin akses:** `credit.analysis.create` (analisa) dan `credit.analysis.view` (riwayat/unduh), diperiksa di server.
- **Cakupan data:** organisasi → cabang → penugasan (`src/lib/access-scope.ts`).
- **Keterkaitan wajib:** setiap analisa wajib memilih debitur terdaftar pada pengajuan kredit; hasil tersimpan di `slik_analysis_records` dan dapat dilihat/diunduh ulang.
- **Audit:** setiap analisa (CREATE), lihat ulang (VIEW), dan unduh ulang (DOWNLOAD) dicatat ke audit log — **tanpa** isi dokumen/NIK.
- **Input tidak tepercaya:** isi dokumen SLIK diperlakukan sebagai data tidak tepercaya; respons model dibersihkan dari blok markdown, dipaksa ke skema JSON, dan dinormalisasi sehingga tidak pernah merusak render (penguatan anti *prompt injection* lanjutan dirancang pada Tahap 5B).
- **Rate limit:** 6 analisa per 5 menit per klien.

## 6. Keputusan yang masih menunggu pemilik proses / compliance

1. **Masking/anonimisasi data sensitif** (mis. NIK) sebelum dikirim ke penyedia eksternal — saat ini **belum diterapkan**; P0.5 mensyaratkan "jika telah disetujui dan layak secara teknis". **Perlu keputusan compliance.**
2. **Retensi** hasil analisa (`slik_analysis_records`) dan dokumen sumber — mengikuti kebijakan retensi dokumen yang akan ditetapkan (Tahap 12 / P1.4).
3. **Dasar hukum/DPIA** pengiriman data SLIK ke penyedia AI pihak ketiga — perlu dokumentasi resmi dari pemilik proses, legal, dan keamanan.
4. **Lokasi pemrosesan** data oleh penyedia (OpenRouter → model pihak ketiga) dan kecocokannya dengan kebijakan kerahasiaan data nasabah OJK.

## 7. Penelusuran kode

| Bagian | Lokasi |
|---|---|
| Klien OpenRouter + prompt | `src/lib/slik/openrouter.ts` |
| Skema & normalisasi output | `src/lib/slik/types.ts` |
| Ekstraksi teks PDF (lokal) | `src/lib/slik/pdfText.ts` |
| API analisa + penyimpanan | `src/app/api/analyze-slik/route.ts` |
| Riwayat / lihat & unduh ulang | `src/app/api/slik/analyses/**` |
| Pilihan debitur | `src/app/api/slik/debtors/route.ts` |
