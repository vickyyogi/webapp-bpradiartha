# PROTOKOL WAJIB: SATU TAHAP PER SESI

> **Aturan paling penting:** AI Coding Agent hanya boleh mengerjakan **satu tahap dalam satu sesi kerja**. Jangan melanjutkan ke tahap berikutnya secara otomatis, sekalipun tahap saat ini selesai lebih cepat atau masih ada token/waktu.

## A. Arti “Satu Tahap”

Satu tahap adalah satu unit pekerjaan dengan tujuan, ruang lingkup, perubahan kode, pengujian, dan kriteria selesai yang jelas. Satu tahap boleh menyentuh beberapa file jika semuanya diperlukan untuk tujuan tahap tersebut, tetapi tidak boleh sekaligus mengerjakan tahap lain.

Contoh:
- Sesi untuk audit repository hanya menghasilkan audit dan rencana; **tidak mengubah kode aplikasi**.
- Sesi untuk memperbaiki autentikasi hanya menangani ruang lingkup autentikasi yang telah disepakati; jangan sekaligus membangun modul agunan atau laporan.
- Jika pekerjaan tahap berjalan ternyata memerlukan keputusan bisnis, migrasi berisiko, atau perubahan di luar ruang lingkup, hentikan bagian tersebut dan laporkan sebagai `BLOCKED` atau `NEEDS HUMAN REVIEW`.

## B. Prosedur Wajib pada Setiap Sesi

Pada awal setiap sesi:

1. Baca file instruksi ini.
2. Baca status pekerjaan terakhir, terutama bagian `Tahap aktif`, `Tahap selesai`, `Tahap berikutnya`, dan `Keputusan yang dibutuhkan`.
3. Tentukan **tepat satu tahap aktif**. Jika pengguna belum memilih tahap, gunakan tahap berikutnya yang tercatat di laporan terakhir. Jika belum ada laporan sebelumnya, mulai dari **Tahap 0 — Audit Repository**.
4. Tulis tujuan dan batasan tahap aktif sebelum mulai bekerja.
5. Jangan melakukan pekerjaan di luar tahap aktif. Jika menemukan masalah lain, catat sebagai temuan untuk tahap berikutnya tanpa memperbaikinya sekarang, kecuali masalah itu mutlak menghalangi atau membuat tahap aktif tidak aman.

Selama sesi:

6. Lakukan hanya pekerjaan yang diperlukan untuk tahap aktif.
7. Jangan menjalankan refactor besar, mengubah stack, atau menambah fitur lain yang tidak diperlukan.
8. Jalankan pemeriksaan dan pengujian yang relevan untuk tahap aktif.
9. Jangan mengklaim pengujian berhasil jika perintah belum benar-benar dijalankan.

Pada akhir setiap sesi:

10. Hentikan pengerjaan setelah tahap aktif selesai, terhalang, atau membutuhkan keputusan manusia.
11. Berikan laporan akhir dengan format pada bagian **Laporan Akhir Sesi** di bawah.
12. Catat tahap berikutnya sebagai rekomendasi saja. **Jangan mulai tahap berikutnya sampai pengguna memulai sesi baru atau memberikan instruksi eksplisit.**
13. Jangan mengerjakan beberapa tahap dalam satu respons atau dengan alasan “sekalian”.

## C. Tahapan Kerja

Gunakan urutan berikut. Tahap dapat dipecah menjadi sub-tahap yang lebih kecil bila cakupannya terlalu besar, tetapi jangan menggabungkan beberapa tahap hanya untuk mempercepat pengerjaan.

| Tahap | Ruang lingkup | Batas hasil sesi |
|---|---|---|
| **Tahap 0** | Audit repository, verifikasi temuan, inventarisasi risiko, dan rencana kerja | Laporan saja; jangan ubah kode aplikasi |
| **Tahap 1** | P0.1 — Autentikasi, hashing kata sandi, sesi, dan manajemen akun | Hanya perbaikan autentikasi/akun yang telah direncanakan |
| **Tahap 2** | P0.2 — Pemisahan master nasabah/debitur dari pegawai | Hanya model, relasi, migrasi, dan penyesuaian terkait tahap ini |
| **Tahap 3** | P0.3 — Otorisasi berbasis role, cabang, penugasan, dan Maker-Checker | Hanya kontrol akses dan pengujian terkait |
| **Tahap 4** | P0.4 — Penyimpanan dokumen privat dan endpoint akses | Hanya keamanan penyimpanan/akses berkas |
| **Tahap 5** | P0.5 — Tata kelola AI dan pemrosesan dokumen SLIK | Hanya kontrol AI/SLIK; jangan mengirim data nyata ke pihak eksternal tanpa persetujuan |
| **Tahap 6** | P0.6 — Presisi angka keuangan dan migrasi ke Decimal | Hanya tipe data dan kalkulasi keuangan terkait |
| **Tahap 7** | P1.6 — Audit trail dan logging | Hanya audit trail, logging, dan pengujian terkait |
| **Tahap 8** | P1.5 — Pelaporan manajemen dan ekspor data | Hanya laporan, masking, ekspor, dan proteksinya |
| **Tahap 9** | P1.1 — Penyempurnaan alur kredit end-to-end | Hanya workflow kredit yang disetujui |
| **Tahap 10** | P1.2 — Manajemen agunan | Hanya fitur dan data agunan |
| **Tahap 11** | P1.3 — Pemantauan pascapencairan | Hanya pelacakan operasional pascapencairan; bukan ledger CBS |
| **Tahap 12** | P1.4 — KYC dan kepatuhan | Hanya fitur kepatuhan yang telah divalidasi |
| **Tahap 13** | P2.1 — QA, CI/CD, backup, dan disaster recovery | Hanya kesiapan teknis dan operasional |
| **Tahap 14** | P2.2 — Parameter operasional yang dapat dikonfigurasi | Hanya konfigurasi workflow/parameter yang telah disahkan |
| **Tahap 15** | Review akhir kesiapan rilis | Pemeriksaan dan laporan; jangan menyatakan siap produksi tanpa bukti dan persetujuan |

Tahap 0 harus dilakukan terlebih dahulu. Setelah audit, agent boleh merekomendasikan penyesuaian urutan berdasarkan dependensi atau temuan aktual, tetapi harus menjelaskan alasannya dan meminta persetujuan sebelum mengubah urutan. Perubahan urutan tidak mengizinkan pengerjaan lebih dari satu tahap dalam satu sesi.

## D. Jika Tahap Terlalu Besar

Jika satu tahap tidak realistis diselesaikan dalam satu sesi:

1. Pecah menjadi sub-tahap yang sempit, misalnya `Tahap 1A`, `Tahap 1B`, dan seterusnya.
2. Kerjakan hanya satu sub-tahap dalam sesi itu.
3. Dokumentasikan bagian yang selesai dan yang belum selesai.
4. Pada sesi berikutnya, lanjutkan dari sub-tahap yang tercatat, bukan mengulang perubahan atau melompat ke tahap lain.
5. Jangan menandai tahap induk sebagai `DONE` sampai seluruh sub-tahap, kriteria penerimaan, dan pengujian wajibnya selesai.

## E. Laporan Akhir Sesi — Format Wajib

Setiap sesi harus diakhiri dengan format berikut:

```markdown
# Laporan Sesi Coding Agent

- Tahap aktif:
- Status: DONE / PARTIAL / BLOCKED / NEEDS HUMAN REVIEW
- Tujuan sesi:
- Ringkasan hasil:

## File yang diperiksa
- ...

## File yang diubah
- ...

## Pengujian
- Perintah:
- Hasil aktual:
- Pengujian yang belum dijalankan dan alasannya:

## Migrasi dan risiko data
- ...

## Risiko atau keputusan yang masih diperlukan
- ...

## Tahap selesai
- ...

## Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)
- Nomor dan nama tahap:
- Prasyarat:
- Persetujuan/keputusan yang dibutuhkan:

## Status untuk sesi berikutnya
- Instruksi singkat untuk melanjutkan dari kondisi repository saat ini.
```

Gunakan status:
- `DONE`: seluruh ruang lingkup tahap dan kriteria penerimaan telah dipenuhi serta pengujian relevan dijalankan.
- `PARTIAL`: sebagian pekerjaan selesai, tetapi masih ada pekerjaan dalam tahap yang sama.
- `BLOCKED`: tidak dapat melanjutkan dengan aman karena hambatan teknis atau dependensi.
- `NEEDS HUMAN REVIEW`: memerlukan keputusan/persetujuan manusia.

## F. Larangan Melanjutkan Otomatis

- Jangan mulai tahap berikutnya setelah menulis laporan.
- Jangan menganggap diamnya pengguna sebagai persetujuan.
- Jangan menyelesaikan tahap lain “sekalian”.
- Jangan mengubah file yang tidak berkaitan dengan tahap aktif, kecuali perubahan minimal yang mutlak diperlukan dan dijelaskan dalam laporan.
- Jangan menjalankan migrasi destruktif atau perubahan produksi tanpa persetujuan eksplisit.
- Jika sesi baru hanya mengatakan “lanjutkan”, lanjutkan **satu tahap berikutnya yang tercatat** saja, lalu berhenti lagi setelah melaporkan hasil.

---

# AI Coding Agent Instructions — Perbaikan Operasional & Keamanan Aplikasi BPR

## 1. Peran dan Tujuan

Anda bertindak sebagai **AI Coding Agent** untuk meninjau, memperbaiki, dan mengembangkan aplikasi operasional Bank Perekonomian Rakyat (BPR) yang sudah ada.

Tujuan utama adalah meningkatkan keamanan, integritas data, kontrol akses, keandalan audit, dan kesiapan operasional aplikasi berdasarkan temuan di dokumen ini. **Jangan langsung menambah banyak fitur baru sebelum masalah keamanan Prioritas 0 ditangani.**

Aplikasi ini merupakan **sistem pendukung operasional BPR, bukan pengganti Core Banking System (CBS)**. Jangan membangun ledger inti perbankan atau menganggap aplikasi ini sebagai sumber resmi saldo/rekening. Pencatatan nomor referensi CBS dan rekonsiliasi operasional dapat disediakan. Integrasi atau sinkronisasi langsung dengan CBS tidak boleh diimplementasikan tanpa persetujuan eksplisit dan spesifikasi resmi.

## 2. Konteks dan Modul yang Telah Ada

Berdasarkan peninjauan sebelumnya, aplikasi memiliki fondasi modul berikut. Verifikasi keberadaan dan implementasi aktualnya di repository sebelum mengubah kode:

- CRM dan pengajuan: pengelolaan prospek/calon nasabah dan formulir pengajuan melalui website.
- Siklus kredit: pengajuan, penugasan, analisis berjenjang, riwayat status, dan pencatatan keputusan.
- Analisis SLIK: ekstraksi serta analisis dokumen SLIK berbantuan AI.
- Operasional lapangan: penugasan petugas dan pengukuran kinerja.
- Manajemen dokumen: berkas dan arsip pendukung.
- Logistik dan aset: inventaris, pemeliharaan, vendor, pengadaan, Purchase Order (PO), dan penerimaan barang.
- Administrasi: role dan permission, audit log, notifikasi, CMS, dan laporan operasional.

## 3. Aturan Kerja Wajib untuk Agent

1. **Audit repository terlebih dahulu.** Periksa struktur project, framework, ORM, skema database, API route, autentikasi, otorisasi, penyimpanan file, pengujian, dan konfigurasi deployment.
2. Cocokkan setiap temuan dalam dokumen ini dengan kode aktual. Jangan menganggap temuan lama masih benar tanpa verifikasi.
3. Buat rencana perubahan bertahap sebelum melakukan perubahan besar. Sebutkan file yang terdampak, risiko, migrasi data, dan pengujian yang diperlukan.
4. Utamakan kompatibilitas dengan arsitektur serta konvensi kode yang sudah digunakan. Jangan mengganti stack teknologi tanpa alasan kuat dan persetujuan.
5. Jangan menghapus atau merusak data yang sudah ada. Semua perubahan skema harus disertai migrasi yang aman, strategi backfill bila diperlukan, dan rencana rollback.
6. Jangan membuat kredensial default, hard-coded secrets, atau menaruh rahasia di repository. Gunakan environment variables dan dokumentasikan variabel yang diperlukan.
7. Terapkan validasi dan otorisasi **di server**, bukan hanya menyembunyikan tombol atau menu di frontend.
8. Jangan mengirim data nasabah, NIK, dokumen identitas, atau dokumen SLIK ke layanan eksternal tanpa persetujuan, kajian privasi, dan konfigurasi yang telah disetujui.
9. Output AI adalah alat bantu analisis, bukan keputusan kredit final. Keputusan harus dibuat dan dicatat oleh pejabat berwenang.
10. Jangan menyatakan aplikasi siap produksi hanya karena build berhasil. Kesiapan harus didukung pengujian keamanan, otorisasi, integritas data, backup, dan pemulihan.
11. Jika ada aturan kredit, regulasi, atau SOP yang belum ditentukan, tandai sebagai **perlu konfirmasi pemilik proses/compliance**. Jangan mengarang kebijakan.
12. Kerjakan dalam perubahan kecil yang mudah ditinjau. Setelah tiap tahap, jalankan pemeriksaan dan laporkan hasilnya.

## 4. Prioritas Implementasi

### P0 — Wajib sebelum menggunakan data nyata/produksi

#### P0.1 Autentikasi dan kata sandi

Temuan yang perlu diverifikasi:
- `src/app/api/auth/[...nextauth]/route.ts` sebelumnya dilaporkan membandingkan kata sandi dalam bentuk plaintext.
- `src/app/api/credit/applications/route.ts` sebelumnya dilaporkan membuat kata sandi default statis.

Tugas:
- Gunakan password hashing yang sesuai standar, misalnya Argon2id atau bcrypt dengan konfigurasi yang aman.
- Rancang migrasi akun lama secara aman; jangan mengunci semua pengguna tanpa rencana pemulihan.
- Hapus pembuatan password default statis.
- Pisahkan akun pemohon/debitur dari akun pegawai. Jangan membuat pemohon menjadi akun pegawai.
- Implementasikan reset password yang aman, kebijakan password, serta pencatatan perubahan yang tidak menyimpan password.
- Wajibkan MFA untuk administrator dan peran berisiko tinggi jika didukung oleh arsitektur.
- Terapkan rate limiting pada login, penanganan kegagalan berulang, dan deteksi aktivitas mencurigakan.
- Atur masa berlaku sesi, pencabutan sesi saat akun dinonaktifkan atau hak akses berubah, dan perlindungan terhadap penyalahgunaan sesi.

Kriteria selesai:
- Tidak ada password plaintext atau password default statis.
- Uji login sukses/gagal, reset password, rate limiting, dan pencabutan sesi.
- Tidak ada rahasia yang tercatat di log.

#### P0.2 Pisahkan master nasabah/debitur dari pegawai

Tugas:
- Buat entitas master Nasabah/Debitur yang terpisah dari entitas User/Pegawai.
- Strukturkan identitas sesuai kebutuhan dan dasar hukum: nomor nasabah internal, nama legal, NIK/NPWP bila relevan, kontak, serta tanggal lahir/tanggal berdiri.
- Catat perubahan identitas, pengguna yang melakukan perubahan, waktu perubahan, dan petugas verifikator.
- Sediakan deteksi potensi duplikasi berdasarkan NIK atau ID usaha dengan perlindungan akses yang sesuai.
- Dukung pencatatan hubungan antar-pihak jika diperlukan, seperti pasangan, penjamin, dan Ultimate Beneficial Owner (UBO).
- Catat bukti persetujuan pemrosesan data pribadi sesuai kebijakan yang disahkan.

Kriteria selesai:
- Relasi pengajuan kredit ke nasabah tidak bergantung pada akun pegawai.
- Migrasi data lama telah dipetakan, divalidasi, dan diuji.
- Data identitas tidak disimpan sebagai catatan bebas jika tersedia kolom terstruktur yang sesuai.

#### P0.3 Otorisasi cabang, penugasan, dan Maker-Checker

Temuan yang perlu diverifikasi:
- `src/lib/permissions.ts` sebelumnya dilaporkan dominan memeriksa role umum dan belum menegakkan batas cabang/penugasan secara universal.

Tugas:
- Terapkan otorisasi server berdasarkan role, organisasi/cabang, departemen, dan penugasan.
- Terapkan prinsip Maker-Checker: pengaju, analis, dan pemutus kredit harus merupakan akun berbeda sesuai alur yang disahkan.
- Cegah persetujuan mandiri pada pengajuan, keputusan kredit, pengadaan, atau transaksi penting.
- Batasi ekspor dan unduhan data sensitif menurut hak akses.
- Periksa seluruh API route, server action, query, serta akses berkas untuk risiko IDOR dan akses lintas cabang.
- Tangani mutasi pegawai, perpindahan cabang, perubahan role, dan penonaktifan akun agar akses lama dicabut segera.

Kriteria selesai:
- Pengguna tidak dapat mengakses data cabang atau penugasan lain hanya dengan mengubah ID pada URL/request.
- Uji negatif lintas role, cabang, dan penugasan tersedia.
- Pemisahan tugas diterapkan di server dan memiliki pengujian otomatis.

#### P0.4 Penyimpanan dan akses dokumen

Temuan yang perlu diverifikasi:
- Berkas sebelumnya dilaporkan disimpan di jalur lokal atau folder publik seperti `public/uploads`.

Tugas:
- Pindahkan dokumen sensitif ke private object storage yang sesuai dengan infrastruktur project.
- Sediakan endpoint unduh yang memverifikasi autentikasi, otorisasi, kepemilikan/penugasan, dan kategori dokumen.
- Validasi tipe file menggunakan MIME type dan pemeriksaan signature/magic bytes, bukan ekstensi saja.
- Terapkan batas ukuran, nama file yang aman, dan pemindaian malware bila infrastruktur mendukung.
- Gunakan enkripsi saat transit dan saat tersimpan.
- Catat akses dan unduhan dokumen tanpa mencatat isi dokumen atau data sensitif secara berlebihan.
- Pisahkan hak akses untuk dokumen umum, dokumen kredit, dokumen SLIK, dan dokumen identitas.
- Jangan membuat URL publik permanen untuk dokumen sensitif.

Kriteria selesai:
- Dokumen sensitif tidak dapat diakses tanpa otorisasi.
- Uji akses langsung, akses lintas cabang, tipe file palsu, dan ukuran file tersedia.
- Proses migrasi file lama telah diverifikasi sebelum file lama dihapus.

#### P0.5 Tata kelola AI dan dokumen SLIK

Temuan yang perlu diverifikasi:
- Teks PDF SLIK sebelumnya dilaporkan dikirim ke pihak ketiga (OpenRouter).
- Modul AI sebelumnya dilaporkan memberikan rekomendasi `APPROVE`/`REJECT`.

Tugas:
- Petakan data yang dikirim ke penyedia AI dan pastikan alur ini dinonaktifkan sampai penggunaan pihak ketiga disetujui oleh pemilik proses, legal/compliance, dan pihak keamanan.
- Minimalkan, masking, atau anonimisasi data sensitif sebelum pemrosesan eksternal jika telah disetujui dan layak secara teknis.
- Tampilkan dengan jelas bahwa hasil AI adalah alat bantu analisis, bukan keputusan final.
- Wajibkan pejabat pemutus mencatat keputusan akhir dan alasan/pertimbangannya.
- Wajibkan verifikasi manual angka baki debet, tunggakan, dan kolektibilitas hasil ekstraksi AI.
- Batasi akses ke dokumen dan hasil ekstraksi SLIK serta catat akses pentingnya.
- Tangani kegagalan, output tidak valid, dan prompt injection dari isi dokumen sebagai input tidak tepercaya.

Kriteria selesai:
- Tidak ada keputusan kredit otomatis hanya berdasarkan output AI.
- Data yang dikirim ke penyedia eksternal terdokumentasi dan disetujui.
- Hasil AI dapat ditinjau, dikoreksi, dan ditelusuri.

#### P0.6 Presisi angka keuangan

Temuan yang perlu diverifikasi:
- `schema.prisma` sebelumnya dilaporkan menggunakan `Float` untuk nominal rupiah.

Tugas:
- Gunakan tipe `Decimal`/`NUMERIC(18,2)` atau tipe presisi tetap yang sesuai untuk nominal uang.
- Audit kalkulasi nominal, bunga, pajak, biaya, dan total laporan.
- Tetapkan aturan pembulatan secara eksplisit dan validasi di backend.
- Tambahkan constraint nilai, misalnya nominal harus positif dan tenor harus valid sesuai aturan produk.
- Hindari parsing angka yang bergantung pada format lokal atau string tanpa validasi.
- Rencanakan migrasi dari Float ke Decimal dan bandingkan hasil sebelum/sesudah migrasi.

Kriteria selesai:
- Tidak ada tipe floating point untuk penyimpanan nominal uang yang perlu presisi finansial.
- Tes batas nilai, pembulatan, total, dan input tidak valid tersedia.

### P1 — Kelengkapan fitur operasional dan kepatuhan

#### P1.1 Alur kredit end-to-end
- Kelola master produk kredit, persyaratan dokumen, kriteria, dan limit kewenangan per cabang sesuai aturan yang disahkan.
- Sediakan checklist verifikasi berkas dan alasan pengembalian.
- Standardisasi formulir analisis dan survei lapangan, termasuk bukti kunjungan/foto bila diperlukan.
- Sediakan pencatatan keputusan Komite Kredit, quorum, syarat persetujuan, peserta, dan waktu keputusan sesuai SOP.
- Catat syarat sebelum pencairan dan referensi transaksi CBS; modul ini hanya mencatat dan mendukung proses operasional, bukan menggantikan pencatatan resmi CBS.
- Gunakan nomor aplikasi yang unik dan aman terhadap konkurensi.
- Simpan riwayat perubahan/koreksi setelah pengajuan resmi dikirimkan, dengan audit trail.

#### P1.2 Manajemen agunan
- Buat entitas agunan tersendiri yang berelasi dengan nasabah dan pengajuan kredit.
- Catat jenis agunan, bukti kepemilikan, pemilik legal, serta hubungan dengan debitur.
- Catat taksasi: nilai pasar/NJOP, penilai, metode, tanggal, dan riwayat penilaian.
- Catat status pengikatan hukum (misalnya HT/Fidusia), asuransi, dan lokasi fisik jika relevan.
- Sediakan pengingat penilaian ulang dan dokumen kedaluwarsa.

#### P1.3 Pemantauan pascapencairan
- Lacak pemenuhan syarat lanjutan pascapencairan.
- Catat nomor kontrak/rekening CBS sebagai referensi operasional, bukan sebagai ledger utama.
- Sediakan pengingat jatuh tempo dan tugas tindak lanjut petugas lapangan.
- Catat kunjungan pembinaan, janji bayar, dan eskalasi penagihan.
- Sinkronisasi otomatis status kolektibilitas/saldo dari CBS merupakan **opsi masa depan** dan tidak boleh dibangun sebelum ada persetujuan, akses resmi, serta spesifikasi integrasi yang terdokumentasi.

#### P1.4 KYC dan kepatuhan
- Sediakan checklist verifikasi identitas dan dokumen oleh verifikator.
- Catat persetujuan pemrosesan data pribadi.
- Rancang risk rating dan screening PEP/daftar terkait hanya setelah sumber data, dasar hukum, dan prosedur eskalasinya disetujui.
- Sediakan alur eskalasi dan keputusan tim Compliance.
- Rancang retensi dan pemusnahan dokumen berdasarkan kebijakan/regulasi yang divalidasi oleh pihak berwenang.
- Sediakan laporan audit kepatuhan sesuai kebutuhan yang telah disahkan.

#### P1.5 Pelaporan manajemen dan ekspor
- Sediakan laporan berjenjang berdasarkan cabang, periode, produk, AO, dan analis.
- Pantau SLA pengajuan, bottleneck, dan backlog.
- Sediakan laporan kelengkapan dokumen dan rekonsiliasi pencatatan operasional dengan referensi/data CBS yang tersedia secara sah.
- Sediakan laporan tindak lanjut pascapencairan.
- Masking PII (misalnya kontak/NIK) pada tampilan dan ekspor sesuai hak akses.
- Cegah CSV Injection dengan menetralkan nilai berbahaya.
- Terapkan paginasi/streaming yang aman untuk ekspor besar.
- Dokumentasikan definisi setiap metrik agar laporan konsisten.

#### P1.6 Audit trail dan logging
Temuan yang perlu diverifikasi:
- `src/lib/audit.ts` sebelumnya dilaporkan mengabaikan kegagalan penulisan log.

Tugas:
- Catat tindakan penting: login, perubahan role, approval, ekspor, unduhan dokumen, perubahan data master, dan perubahan konfigurasi.
- Jangan menulis password, token, isi dokumen, atau NIK plaintext ke log.
- Berikan alert/penanganan eksplisit jika audit log gagal ditulis.
- Gunakan transaksi database untuk membuat perubahan penting dan audit log atomik bila memungkinkan.
- Batasi akses log dan tetapkan retensi berdasarkan kebijakan yang disetujui.
- Jangan membiarkan kegagalan logging kritis terjadi tanpa deteksi; dokumentasikan perilaku sistem ketika audit service tidak tersedia.

### P2 — Kesiapan teknis dan infrastruktur produksi

#### P2.1 QA dan standardisasi kode
Temuan yang perlu diverifikasi:
- `next.config.ts` sebelumnya dilaporkan menggunakan `ignoreBuildErrors: true`.

Tugas:
- Hilangkan pengabaian error TypeScript setelah error aktual diperbaiki.
- Tambahkan unit test dan integration test untuk permission, kalkulasi nominal, workflow, dan approval.
- Siapkan CI/CD dengan pemeriksaan otomatis sebelum merge/deploy.
- Tambahkan application performance monitoring dan centralized logging bila sesuai infrastruktur.
- Sediakan automated backup dan prosedur disaster recovery; lakukan simulasi pemulihan berkala.
- Dokumentasikan Business Continuity Plan (BCP).

#### P2.2 Parameter operasional
- Buat workflow dan penetapan pejabat pemutus dapat dikonfigurasi sesuai kebijakan yang disahkan.
- Kelola matriks limit kewenangan memutus kredit.
- Dukung kalender kerja/hari libur untuk perhitungan SLA.
- Catat versi, pembuat, waktu, dan persetujuan perubahan konfigurasi.
- Sediakan simulasi/pengujian workflow sebelum konfigurasi dipublikasikan ke produksi.
- Jangan mengubah kebijakan kredit atau limit kewenangan berdasarkan asumsi agent.

## 5. Urutan Kerja yang Disarankan

Laksanakan secara bertahap dan jangan mengerjakan seluruh daftar dalam satu perubahan besar.

1. Audit repository dan buat daftar temuan aktual beserta bukti file/line.
2. Susun rencana perbaikan, risiko, migrasi, dan pengujian.
3. Amankan autentikasi, hashing kata sandi, sesi, dan manajemen akun.
4. Pisahkan master nasabah/debitur dari pegawai dan migrasikan data secara aman.
5. Tegakkan otorisasi cabang/penugasan dan Maker-Checker.
6. Amankan penyimpanan dokumen dan endpoint akses.
7. Tetapkan tata kelola AI SLIK dan cegah keputusan otomatis berbasis AI.
8. Migrasikan nominal ke tipe Decimal dan validasi seluruh kalkulasi terkait.
9. Perkuat audit trail, ekspor, dan pelaporan.
10. Lengkapi workflow kredit, agunan, pascapencairan, dan kepatuhan.
11. Lengkapi pengujian otomatis, CI/CD, backup, serta uji pemulihan.
12. Lakukan review akhir dan siapkan checklist go-live.

## 6. Persyaratan Pengujian Minimum

Agent harus menambahkan atau memperbarui pengujian yang mencakup:

- Autentikasi, password hashing, reset password, rate limiting, dan sesi.
- Otorisasi per role, cabang, departemen, penugasan, serta IDOR.
- Pencegahan self-approval dan pemisahan Maker-Checker.
- Validasi input server-side dan proteksi endpoint.
- Akses dokumen, validasi file, serta larangan akses publik yang tidak sah.
- Migrasi relasi nasabah/pegawai dan deduplikasi.
- Kalkulasi uang, pembulatan, batas nominal, dan konversi Decimal.
- Audit trail untuk tindakan penting dan perilaku saat logging gagal.
- Ekspor data, masking PII, paginasi, dan CSV Injection.
- Penanganan output AI yang tidak valid dan verifikasi keputusan oleh manusia.

Jangan mengklaim tes lulus jika belum benar-benar dijalankan. Laporkan tes yang tidak dapat dijalankan beserta alasannya.

## 7. Format Laporan Setelah Setiap Tahap

Setelah menyelesaikan setiap tahap, laporkan:

1. **Temuan yang diverifikasi:** apa yang ditemukan pada kode aktual dan lokasinya.
2. **Perubahan:** file yang dibuat/diubah dan tujuan perubahan.
3. **Migrasi:** perubahan skema/data, cara menjalankan, dan langkah rollback.
4. **Pengujian:** perintah yang dijalankan dan hasil sebenarnya.
5. **Risiko tersisa:** isu yang belum selesai atau membutuhkan keputusan manusia.
6. **Langkah berikutnya:** satu tahap berikut yang paling aman dan relevan.

Gunakan status `DONE`, `PARTIAL`, `BLOCKED`, atau `NEEDS HUMAN REVIEW` untuk setiap item prioritas. Jangan menandai item `DONE` hanya karena kode telah ditulis; pastikan kriteria penerimaan dan tes relevan telah dipenuhi.

## 8. Batasan dan Keputusan yang Memerlukan Persetujuan Manusia

Agent wajib meminta konfirmasi sebelum:
- Mengubah aturan kredit, limit kewenangan, atau SOP.
- Mengirim data nasabah/SLIK ke penyedia AI atau pihak ketiga.
- Mengaktifkan integrasi/sinkronisasi langsung ke CBS.
- Menghapus atau melakukan transformasi data yang berpotensi kehilangan informasi.
- Mengubah mekanisme autentikasi produksi yang dapat memengaruhi akses pengguna.
- Menetapkan kebijakan retensi/pemusnahan data.
- Menyatakan aplikasi siap produksi.

## 9. Definisi Selesai dan Kesiapan Produksi

Aplikasi belum boleh dinyatakan siap produksi sampai, sekurang-kurangnya:

- Tidak ada password plaintext/default credential.
- Data nasabah/debitur terpisah dari akun pegawai.
- Otorisasi cabang/penugasan dan Maker-Checker diuji.
- Dokumen sensitif tersimpan privat dan aksesnya diverifikasi.
- Pemrosesan AI SLIK memiliki persetujuan serta kontrol yang memadai, atau dinonaktifkan.
- Nominal uang menggunakan tipe presisi yang sesuai dan kalkulasinya diuji.
- Audit log untuk tindakan penting dapat diandalkan.
- Tes kritis, backup, dan pemulihan telah dijalankan.
- Temuan tersisa dan risiko residual didokumentasikan serta disetujui pemilik sistem.

**Catatan:** Dokumen ini merupakan instruksi rekayasa berdasarkan laporan peninjauan statis, bukan pengganti audit keamanan formal, penetration testing, validasi SOP, atau penilaian legal/compliance. Seluruh kontrol dan aturan yang berkaitan dengan regulasi perbankan harus divalidasi oleh pihak yang berwenang.
