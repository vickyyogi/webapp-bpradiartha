# TASK: Modifikasi SLIK OJK Analyzer & Generator PDF "Credit Risk Assessment"

Tolong implementasikan pembaruan pada fitur analisa SLIK OJK di project Next.js ini. Sistem menggunakan **OpenRouter API** dan menghasilkan laporan PDF resmi berformat **Credit Risk Assessment** yang persis dengan layout referensi internal perbankan. Fitur ini bisa input Multiple File PDF dan hasilnya akan dijadikan 1 file Laporan PDF.

---

## 1. Requirement Arsitektur & Teknologi

1. **Backend / API Route (`app/api/analyze-slik/route.js`):**
   - Menggunakan parser lokal `pdf-parse-fork` untuk membaca teks biner PDF.
   - Mengirim teks hasil ekstraksi ke endpoint OpenRouter: `https://openrouter.ai/api/v1/chat/completions`.
   - Gunakan API key dari: `process.env.OPENROUTER_API_KEY`.
   - Model default: `qwen/qwen3.7-flash` (fallback: `deepseek/deepseek-v4.1-flash`).
   - Menerima keluaran **JSON murni** tanpa formatting backtick markdown tambahan.

2. **Skema JSON Ekstraksi (Wajib Diikuti):**
```json
{
  "header": {
    "nomor_laporan": "string",
    "posisi_data": "string",
    "operator": "string"
  },
  "data_pribadi": {
    "nama_lengkap": "string",
    "nik": "string",
    "ttl_usia": "string",
    "pekerjaan": "string",
    "pendidikan": "string"
  },
  "ringkasan_eksposur": {
    "total_baki_debet": 0,
    "plafon_efektif": "string",
    "kualitas_terburuk": "string",
    "total_kreditur": "string",
    "total_fasilitas": "string"
  },
  "rincian_tunggakan": {
    "tunggakan_pokok": 0,
    "tunggakan_bunga": 0,
    "denda_berjalan": 0,
    "total_tunggakan_real": 0
  },
  "fasilitas": [
    {
      "bank_pelapor": "string",
      "jenis_fasilitas": "string",
      "plafon_awal": 0,
      "baki_debet": 0,
      "suku_bunga": "string",
      "kolektibilitas": "string",
      "hari_tunggakan": 0,
      "status_kondisi": "string",
      "est_angsuran_bulan": 0,
      "catatan_khusus": "string"
    }
  ],
  "analisis_dan_rekomendasi": {
    "ringkasan_angsuran": [
      {
        "nama_bank": "string",
        "detail": "string",
        "nominal_per_bulan": "string"
      }
    ],
    "total_estimasi_angsuran_bulanan": "string",
    "inventarisasi_agunan": [
      "string"
    ],
    "catatan_kritis_karakter": [
      {
        "judul": "string",
        "uraian": "string"
      }
    ],
    "keputusan_komite": {
      "rekomendasi": "REJECT | APPROVE | CONSIDER",
      "risk_rating": "string",
      "saran_tindakan": [
        "string"
      ],
      "syarat_khusus": [
        "string"
      ]
    }
  }
}

3. **Contoh Code Generator PDF:**
```js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateCreditRiskAssessmentPdf(data) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const formatRupiah = (val) =>
    typeof val === 'number'
      ? `Rp ${val.toLocaleString('id-ID')}`
      : (val || 'Rp 0');

  // ==================== HALAMAN 1 ====================
  // 1. Header Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text('CREDIT RISK ASSESSMENT', 14, 14);

  doc.setTextColor(185, 28, 28);
  doc.text('RAHASIA', pageWidth - 14, 14, { align: 'right' });

  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.text('RINGKASAN & ANALISIS SLIK OJK (IDEB)', 14, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  const subHeader = `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} | Nomor Laporan: ${data.header?.nomor_laporan || '-'} | Posisi Data: ${data.header?.posisi_data || '-'} | Operator: ${data.header?.operator || '-'}`;
  doc.text(subHeader, 14, 26);
  doc.setDrawColor(209, 213, 219);
  doc.line(14, 28, pageWidth - 14, 28);

  // 2. Data Pribadi & Ringkasan Eksposur (2 Kolom)
  const colY = 32;
  const colW = (pageWidth - 32) / 2;

  // Box Kiri: Data Pribadi
  doc.setFillColor(248, 250, 252);
  doc.rect(14, colY, colW, 36, 'F');
  doc.rect(14, colY, colW, 36, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  doc.text('DATA PRIBADI DEBITUR', 18, colY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 41, 55);
  const dataPribadiList = [
    `Nama Lengkap : ${data.data_pribadi?.nama_lengkap || '-'}`,
    `Nomor NIK    : ${data.data_pribadi?.nik || '-'}`,
    `TTL / Usia   : ${data.data_pribadi?.ttl_usia || '-'}`,
    `Pekerjaan    : ${data.data_pribadi?.pekerjaan || '-'}`,
    `Pendidikan   : ${data.data_pribadi?.pendidikan || '-'}`,
  ];
  dataPribadiList.forEach((text, i) => {
    doc.text(text, 18, colY + 12 + i * 5);
  });

  // Box Kanan: Ringkasan Eksposur
  const rightX = 14 + colW + 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(rightX, colY, colW, 36, 'F');
  doc.rect(rightX, colY, colW, 36, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  doc.text('RINGKASAN EKSPOSUR KREDIT', rightX + 4, colY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 41, 55);
  const eksposurList = [
    `Total Baki Debet : ${formatRupiah(data.ringkasan_eksposur?.total_baki_debet)}`,
    `Plafon Efektif   : ${data.ringkasan_eksposur?.plafon_efektif || '-'}`,
    `Kualitas Terburuk: ${data.ringkasan_eksposur?.kualitas_terburuk || '-'}`,
    `Total Kreditur   : ${data.ringkasan_eksposur?.total_kreditur || '-'}`,
    `Total Fasilitas  : ${data.ringkasan_eksposur?.total_fasilitas || '-'}`,
  ];
  eksposurList.forEach((text, i) => {
    doc.text(text, rightX + 4, colY + 12 + i * 5);
  });

  // 3. Tabel Fasilitas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('1. Pengelompokan & Rincian Fasilitas Kredit Debitur', 14, 74);

  const tableRows = (data.fasilitas || []).map((f) => [
    f.bank_pelapor,
    f.jenis_fasilitas,
    typeof f.plafon_awal === 'number' ? f.plafon_awal.toLocaleString('id-ID') : f.plafon_awal,
    typeof f.baki_debet === 'number' ? f.baki_debet.toLocaleString('id-ID') : f.baki_debet,
    f.suku_bunga || '-',
    `${f.kolektibilitas}\n${f.hari_tunggakan || 0} hr`,
    f.status_kondisi || 'Aktif',
    f.est_angsuran_bulan ? formatRupiah(f.est_angsuran_bulan) : '-',
  ]);

  autoTable(doc, {
    startY: 77,
    margin: { left: 14, right: 14 },
    head: [[
      'Bank Pelapor',
      'Jenis Fasilitas',
      'Plafon Awal',
      'Baki Debet',
      'Bunga',
      'Kol/DPD',
      'Status',
      'Est. Angsuran/Bln',
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      halign: 'center',
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [31, 41, 55],
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 36 },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 21 },
    },
  });

  // 4. Box Peringatan Tunggakan
  const warnY = doc.lastAutoTable.finalY + 6;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(248, 113, 113);
  doc.rect(14, warnY, pageWidth - 28, 20, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(153, 27, 27);
  doc.text('PERINGATAN: RINCIAN TUNGGAKAN & HISTORIS HAPUS BUKU', 18, warnY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(31, 41, 55);
  const tunggakanGrid = [
    `Tunggakan Pokok: ${formatRupiah(data.rincian_tunggakan?.tunggakan_pokok)}`,
    `Tunggakan Bunga: ${formatRupiah(data.rincian_tunggakan?.tunggakan_bunga)}`,
    `Denda Berjalan: ${formatRupiah(data.rincian_tunggakan?.denda_berjalan)}`,
    `Total Tunggakan Real: ${formatRupiah(data.rincian_tunggakan?.total_tunggakan_real)}`,
  ];
  tunggakanGrid.forEach((item, idx) => {
    doc.text(`• ${item}`, 18 + idx * 43, warnY + 12);
  });

  // Footer Hal 1
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Laporan Analisa SLIK OJK Debitur: ${data.data_pribadi?.nama_lengkap || '-'}`,
    14,
    288
  );
  doc.text('Halaman 1 dari 2', pageWidth - 14, 288, { align: 'right' });

  // ==================== HALAMAN 2 ====================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('2. PERHITUNGAN ANGSURAN & REKOMENDASI ANALIS KREDIT', 14, 16);

  // Sub A: Angsuran Berjalan
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('A. Analisis Angsuran Berjalan & Total Tanggungan Bulanan', 14, 24);

  let curY = 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 41, 55);

  (data.analisis_dan_rekomendasi?.ringkasan_angsuran || []).forEach((item, idx) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${idx + 1}. ${item.nama_bank}`, 16, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(item.detail, 20, curY + 4);
    doc.text(`Est: ${item.nominal_per_bulan}`, pageWidth - 16, curY + 4, { align: 'right' });
    curY += 10;
  });

  // Highlight Total Angsuran
  doc.setFillColor(241, 245, 249);
  doc.rect(14, curY, pageWidth - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL ESTIMASI BEBAN ANGSURAN BULANAN (ACTIVE OBLIGATION)', 18, curY + 4.5);
  doc.text(
    data.analisis_dan_rekomendasi?.total_estimasi_angsuran_bulanan || 'Rp 0/bulan',
    pageWidth - 18,
    curY + 4.5,
    { align: 'right' }
  );
  curY += 12;

  // Sub B: Inventarisasi Agunan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('B. Inventarisasi Agunan Tercatat pada Fasilitas Eksisting', 14, curY);
  curY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 41, 55);
  (data.analisis_dan_rekomendasi?.inventarisasi_agunan || []).forEach((agunan) => {
    const lines = doc.splitTextToSize(`• ${agunan}`, pageWidth - 32);
    doc.text(lines, 16, curY);
    curY += lines.length * 4 + 1;
  });
  curY += 3;

  // Sub C: Catatan Kritis Karakter
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('C. Catatan Kritis Karakter & Kapasitas Debitur', 14, curY);
  curY += 5;

  (data.analisis_dan_rekomendasi?.catatan_kritis_karakter || []).forEach((catatan) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`• ${catatan.judul}:`, 16, curY);
    const titleWidth = doc.getTextWidth(`• ${catatan.judul}: `);
    doc.setFont('helvetica', 'normal');
    const uLines = doc.splitTextToSize(catatan.uraian, pageWidth - 32 - titleWidth);
    doc.text(uLines, 16 + titleWidth, curY);
    curY += uLines.length * 4 + 2;
  });
  curY += 4;

  // Box KEPUTUSAN KOMITE / ANALIS KREDIT
  const decisionBoxY = curY;
  const isReject = data.analisis_dan_rekomendasi?.keputusan_komite?.rekomendasi?.toUpperCase() === 'REJECT';

  doc.setFillColor(isReject ? 254 : 240, isReject ? 242 : 253, isReject ? 242 : 244);
  doc.setDrawColor(isReject ? 220 : 34, isReject ? 38 : 197, isReject ? 38 : 94);
  doc.rect(14, decisionBoxY, pageWidth - 28, 55, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(isReject ? 153 : 21, isReject ? 27 : 128, isReject ? 27 : 61);
  doc.text('KEPUTUSAN KOMITE / ANALIS KREDIT', 18, decisionBoxY + 6);

  // Status Banner 2 Kolom
  doc.setFontSize(10);
  doc.text(
    `REKOMENDASI: ${data.analisis_dan_rekomendasi?.keputusan_komite?.rekomendasi || 'REJECT'}`,
    18,
    decisionBoxY + 13
  );
  doc.text(
    `RISK RATING: ${data.analisis_dan_rekomendasi?.keputusan_komite?.risk_rating || 'HIGH RISK'}`,
    pageWidth - 18,
    decisionBoxY + 13,
    { align: 'right' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(31, 41, 55);

  let decY = decisionBoxY + 19;
  (data.analisis_dan_rekomendasi?.keputusan_komite?.saran_tindakan || []).forEach((saran, i) => {
    const sLines = doc.splitTextToSize(`${i + 1}. ${saran}`, pageWidth - 36);
    doc.text(sLines, 18, decY);
    decY += sLines.length * 3.8 + 1;
  });

  (data.analisis_dan_rekomendasi?.keputusan_komite?.syarat_khusus || []).forEach((syarat) => {
    const kLines = doc.splitTextToSize(`• ${syarat}`, pageWidth - 36);
    doc.text(kLines, 22, decY);
    decY += kLines.length * 3.6;
  });

  // Footer Hal 2
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Laporan Analisa SLIK OJK Debitur: ${data.data_pribadi?.nama_lengkap || '-'}`,
    14,
    288
  );
  doc.text('Halaman 2 dari 2', pageWidth - 14, 288, { align: 'right' });

  // Download File
  doc.save(`Laporan_Analisa_SLIK_OJK_-_${data.data_pribadi?.nama_lengkap?.replace(/\s+/g, '_') || 'Debitur'}.pdf`);
}