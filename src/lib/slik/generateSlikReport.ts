/**
 * Generator laporan PDF "Credit Risk Assessment" untuk hasil analisa SLIK OJK.
 *
 * Ditulis ulang dari contoh pada docs/slik-analyzer.md dengan perbaikan berikut:
 *  - Tidak ada koordinat Y yang di-hardcode: seluruh isi memakai alur bertingkat
 *    (flow) dengan pemantauan ruang sisa, sehingga jumlah fasilitas / panjang
 *    uraian berapa pun tidak akan menabrak footer atau terpotong.
 *  - Tabel fasilitas boleh pindah halaman sendiri (header tabel diulang).
 *  - Kotak keputusan komite diukur lebih dulu, lalu dipecah ke halaman berikutnya
 *    bila isinya melebihi satu halaman.
 *  - Nomor halaman dihitung di akhir ("Halaman X dari Y"), bukan dipatok 1 dari 2.
 *
 * Modul ini berjalan di browser (client-side). jsPDF di-import secara dinamis
 * supaya bundel halaman tidak membawa library PDF saat belum dipakai.
 */

import type { jsPDF as JsPdf } from "jspdf";
import { formatAngka, formatRupiah, type SlikAnalysis } from "./types";

type PdfDoc = JsPdf;

type RGB = [number, number, number];

/* --------------------------- Konstanta layout --------------------------- */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 14;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 182mm
const TOP_Y = 16;
const FOOTER_Y = 288;
/** Batas bawah area konten (di atas garis footer). */
const BOTTOM_LIMIT = 282;
/** Ruang yang disisihkan di bawah tabel agar tidak menabrak footer. */
const TABLE_BOTTOM_RESERVE = 26;

const NAVY: RGB = [30, 58, 138];
const RED: RGB = [185, 28, 28];
const DARK: RGB = [17, 24, 39];
const BODY: RGB = [31, 41, 55];
const MUTED: RGB = [107, 114, 128];
const BORDER: RGB = [209, 213, 219];
const PANEL: RGB = [248, 250, 252];
const WARN_FILL: RGB = [254, 242, 242];
const WARN_BORDER: RGB = [248, 113, 113];
const WARN_TEXT: RGB = [153, 27, 27];
const OK_FILL: RGB = [240, 253, 244];
const OK_BORDER: RGB = [34, 197, 94];
const OK_TEXT: RGB = [21, 128, 61];

/* ------------------------------ Tipe internal --------------------------- */

interface Flow {
  doc: PdfDoc;
  y: number;
}

/** Satu bagian kecil di dalam kotak: tinggi sudah dihitung saat build. */
interface BoxItem {
  height: number;
  draw: (flow: Flow, top: number) => void;
}

/* ------------------------------ Flow helpers ---------------------------- */

function setColor(doc: PdfDoc, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function addPage(flow: Flow, runningTitle?: string) {
  flow.doc.addPage();
  flow.y = TOP_Y;
  if (runningTitle) {
    const doc = flow.doc;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(doc, NAVY);
    doc.text("CREDIT RISK ASSESSMENT", MARGIN_X, 11);
    doc.setFont("helvetica", "normal");
    setColor(doc, MUTED);
    doc.text(runningTitle, PAGE_W - MARGIN_X, 11, { align: "right" });
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, 13.5, PAGE_W - MARGIN_X, 13.5);
    flow.y = 18;
  }
}

/** Memastikan masih ada `height` mm ruang; kalau tidak, pindah halaman. */
function ensureSpace(flow: Flow, height: number, runningTitle?: string) {
  if (flow.y + height > BOTTOM_LIMIT) addPage(flow, runningTitle);
}

interface ParagraphOptions {
  x?: number;
  width?: number;
  fontSize?: number;
  lineHeight?: number;
  bold?: boolean;
  color?: RGB;
  align?: "left" | "right";
  /** Tambahan jarak sebelum baris pertama. */
  spaceBefore?: number;
  /** Jarak tambahan setelah paragraf selesai. */
  spaceAfter?: number;
  runningTitle?: string;
}

/**
 * Menulis teks yang boleh terpotong ke beberapa baris dan pindah halaman.
 * Mengembalikan tinggi total yang terpakai.
 */
function paragraph(flow: Flow, value: string, options: ParagraphOptions = {}): number {
  const doc = flow.doc;
  const x = options.x ?? MARGIN_X;
  const width = options.width ?? CONTENT_W;
  const fontSize = options.fontSize ?? 7.5;
  const lineHeight = options.lineHeight ?? 4.2;

  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  setColor(doc, options.color ?? BODY);

  const lines: string[] = doc.splitTextToSize(value ?? "", width);
  const spaceBefore = options.spaceBefore ?? 0;
  if (spaceBefore > 0) {
    ensureSpace(flow, spaceBefore, options.runningTitle);
    flow.y += spaceBefore;
  }

  let used = spaceBefore;
  for (const line of lines) {
    if (flow.y + lineHeight > BOTTOM_LIMIT) {
      addPage(flow, options.runningTitle);
    }
    flow.y += lineHeight;
    doc.text(line, x, flow.y, options.align === "right" ? { align: "right" } : undefined);
    used += lineHeight;
  }

  const spaceAfter = options.spaceAfter ?? 0;
  if (spaceAfter > 0) {
    ensureSpace(flow, spaceAfter, options.runningTitle);
    flow.y += spaceAfter;
    used += spaceAfter;
  }

  return used;
}

/** Sub-judul bagian, tidak akan terpisah dari isinya. */
function sectionHeading(flow: Flow, value: string, runningTitle?: string, options: { spaceBefore?: number } = {}) {
  ensureSpace(flow, 12, runningTitle);
  flow.y += options.spaceBefore ?? 4;
  paragraph(flow, value, { fontSize: 9, lineHeight: 5, bold: true, color: DARK, spaceAfter: 1, runningTitle });
}

function subHeading(flow: Flow, value: string, runningTitle?: string) {
  ensureSpace(flow, 9, runningTitle);
  flow.y += 3;
  paragraph(flow, value, { fontSize: 8.5, lineHeight: 4.6, bold: true, color: NAVY, spaceAfter: 0.5, runningTitle });
}

/* ------------------------------- Bagian PDF ----------------------------- */

function drawCoverHeader(doc: PdfDoc, data: SlikAnalysis) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(doc, NAVY);
  doc.text("CREDIT RISK ASSESSMENT", MARGIN_X, 14);

  setColor(doc, RED);
  doc.text("RAHASIA", PAGE_W - MARGIN_X, 14, { align: "right" });

  doc.setFontSize(13);
  setColor(doc, DARK);
  doc.text("RINGKASAN & ANALISIS SLIK OJK (IDEB)", MARGIN_X, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setColor(doc, MUTED);
  const tanggalCetak = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const meta = [
    `Tanggal Cetak: ${tanggalCetak}`,
    `Nomor Laporan: ${data.header.nomor_laporan}`,
    `Posisi Data: ${data.header.posisi_data}`,
    `Operator: ${data.header.operator}`,
  ].join("  |  ");
  doc.text(meta, MARGIN_X, 26);

  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, 28, PAGE_W - MARGIN_X, 28);
}

interface PanelRow {
  label: string;
  value: string;
  highlight?: boolean;
}

/** Dua panel berdampingan (data pribadi & ringkasan eksposur). */
function drawInfoPanels(flow: Flow, data: SlikAnalysis) {
  const doc = flow.doc;
  const gap = 4;
  const panelW = (CONTENT_W - gap) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + panelW + gap;

  const leftRows: PanelRow[] = [
    { label: "Nama Lengkap", value: data.data_pribadi.nama_lengkap },
    { label: "Nomor NIK", value: data.data_pribadi.nik },
    { label: "TTL / Usia", value: data.data_pribadi.ttl_usia },
    { label: "Pekerjaan", value: data.data_pribadi.pekerjaan },
    { label: "Pendidikan", value: data.data_pribadi.pendidikan },
  ];

  const rightRows: PanelRow[] = [
    { label: "Total Baki Debet", value: formatRupiah(data.ringkasan_eksposur.total_baki_debet), highlight: true },
    { label: "Plafon Efektif", value: data.ringkasan_eksposur.plafon_efektif },
    { label: "Kualitas Terburuk", value: data.ringkasan_eksposur.kualitas_terburuk },
    { label: "Total Kreditur", value: data.ringkasan_eksposur.total_kreditur },
    { label: "Total Fasilitas", value: data.ringkasan_eksposur.total_fasilitas },
  ];

  const labelW = 30;
  const rowHeight = 5;
  const panelH = 11 + rowHeight * Math.max(leftRows.length, rightRows.length);

  const drawPanel = (x: number, title: string, rows: PanelRow[]) => {
    doc.setFillColor(PANEL[0], PANEL[1], PANEL[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.2);
    doc.rect(x, flow.y, panelW, panelH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(doc, NAVY);
    doc.text(title, x + 4, flow.y + 6);

    rows.forEach((row, index) => {
      const rowY = flow.y + 12 + index * rowHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setColor(doc, MUTED);
      doc.text(`${row.label}`, x + 4, rowY);
      doc.setFont("helvetica", "bold");
      if (row.highlight) setColor(doc, NAVY);
      const valueLines: string[] = doc.splitTextToSize(row.value, panelW - labelW - 8);
      const firstLine = valueLines[0] ?? "-";
      setColor(doc, row.highlight ? NAVY : BODY);
      doc.text(firstLine, x + 4 + labelW, rowY);
      if (valueLines.length > 1) {
        // Nilai panjang dipotong di baris pertama; sisanya tidak ditampilkan agar
        // tinggi panel tetap presisi terhadap koordinat baris.
        doc.setFont("helvetica", "normal");
        setColor(doc, MUTED);
        doc.text("…", x + panelW - 6, rowY);
      }
    });
  };

  ensureSpace(flow, panelH + 6);
  drawPanel(leftX, "DATA PRIBADI DEBITUR", leftRows);
  drawPanel(rightX, "RINGKASAN EKSPOSUR KREDIT", rightRows);
  flow.y += panelH + 6;
}

function drawFasilitasTable(flow: Flow, data: SlikAnalysis, autoTable: (doc: PdfDoc, options: object) => void) {
  const doc = flow.doc;

  if (data.fasilitas.length === 0) {
    paragraph(flow, "Tidak ada fasilitas kredit yang tercatat pada laporan SLIK.", {
      fontSize: 7.5,
      bold: true,
      color: MUTED,
      spaceAfter: 4,
    });
    return;
  }

  const rows = data.fasilitas.map((f) => [
    f.catatan_khusus && f.catatan_khusus !== "-" ? `${f.bank_pelapor}\n(${f.catatan_khusus})` : f.bank_pelapor,
    f.jenis_fasilitas,
    formatAngka(f.plafon_awal),
    formatAngka(f.baki_debet),
    f.suku_bunga,
    `${f.kolektibilitas}\n${f.hari_tunggakan} hr`,
    f.status_kondisi,
    f.est_angsuran_bulan > 0 ? formatAngka(f.est_angsuran_bulan) : "-",
  ]);

  autoTable(doc, {
    startY: flow.y,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: TABLE_BOTTOM_RESERVE },
    head: [
      [
        "Bank Pelapor",
        "Jenis Fasilitas",
        "Plafon Awal",
        "Baki Debet",
        "Bunga",
        "Kol / DPD",
        "Status",
        "Est. Angsuran/Bln",
      ],
    ],
    body: rows,
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: BODY,
      valign: "middle",
      lineColor: BORDER,
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 36 },
      2: { halign: "right", cellWidth: 20 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "center", cellWidth: 15 },
      5: { halign: "center", cellWidth: 18 },
      6: { halign: "center", cellWidth: 18 },
      7: { halign: "right", cellWidth: 21 },
    },
  });

  // jspdf-autotable menyimpan posisi kursor tabel pada objek dokumen saat runtime
  // (tidak ada di tipe). Dipakai sebagai titik lanjut isi laporan.
  const cursor = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  flow.y = typeof cursor === "number" ? cursor : flow.y;
}

function drawTunggakanBox(flow: Flow, data: SlikAnalysis) {
  const doc = flow.doc;
  const items = [
    `Tunggakan Pokok: ${formatRupiah(data.rincian_tunggakan.tunggakan_pokok)}`,
    `Tunggakan Bunga: ${formatRupiah(data.rincian_tunggakan.tunggakan_bunga)}`,
    `Denda Berjalan: ${formatRupiah(data.rincian_tunggakan.denda_berjalan)}`,
    `Total Tunggakan Real: ${formatRupiah(data.rincian_tunggakan.total_tunggakan_real)}`,
  ].map((item) => `• ${item}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  const innerPadX = 4;
  const colGap = 6;
  const colW = (CONTENT_W - innerPadX * 2 - colGap) / 2;
  const lineHeight = 4.0;

  const grid: string[][] = [
    [items[0], items[1]],
    [items[2], items[3]],
  ];
  const rowHeights = grid.map((row) =>
    Math.max(...row.map((cell) => doc.splitTextToSize(cell, colW).length)) * lineHeight
  );

  const boxH = 7 + 4 + rowHeights.reduce((sum, h) => sum + h, 0) + 4;

  ensureSpace(flow, boxH + 6);

  const top = flow.y;
  doc.setFillColor(WARN_FILL[0], WARN_FILL[1], WARN_FILL[2]);
  doc.setDrawColor(WARN_BORDER[0], WARN_BORDER[1], WARN_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_X, top, CONTENT_W, boxH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setColor(doc, WARN_TEXT);
  doc.text("PERINGATAN: RINCIAN TUNGGAKAN & HISTORIS HAPUS BUKU", MARGIN_X + innerPadX, top + 5.5);

  let rowY = top + 10.5;
  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = MARGIN_X + innerPadX + colIndex * (colW + colGap);
      const lines: string[] = doc.splitTextToSize(cell, colW);
      doc.setFont("helvetica", lines.length > 1 ? "normal" : "bold");
      doc.setFontSize(7);
      setColor(doc, BODY);
      lines.forEach((line, lineIndex) => {
        doc.text(line, x, rowY + (lineIndex + 1) * lineHeight);
      });
    });
    rowY += rowHeights[rowIndex];
  });

  flow.y = top + boxH + 6;
}

/* --------------------------- Kotak keputusan komite --------------------- */

function decisionTheme(rekomendasi: string) {
  if (rekomendasi === "APPROVE") {
    return { fill: OK_FILL, border: OK_BORDER, text: OK_TEXT };
  }
  if (rekomendasi === "CONSIDER") {
    return { fill: WARN_FILL, border: [234, 179, 8] as RGB, text: [161, 98, 7] as RGB };
  }
  return { fill: WARN_FILL, border: [220, 38, 38] as RGB, text: WARN_TEXT };
}

function buildDecisionItems(flow: Flow, data: SlikAnalysis, title: string): BoxItem[] {
  const doc = flow.doc;
  const innerX = MARGIN_X + 4;
  const innerW = CONTENT_W - 8;
  const komite = data.analisis_dan_rekomendasi.keputusan_komite;
  const theme = decisionTheme(komite.rekomendasi);
  const items: BoxItem[] = [];

  // Baris status: rekomendasi (kiri) & risk rating (kanan).
  items.push({
    height: 7,
    draw: (f, top) => {
      f.doc.setFont("helvetica", "bold");
      f.doc.setFontSize(10);
      setColor(f.doc, theme.text);
      f.doc.text(`REKOMENDASI: ${komite.rekomendasi}`, innerX, top + 5);
      f.doc.text(`RISK RATING: ${komite.risk_rating}`, MARGIN_X + CONTENT_W - 4, top + 5, { align: "right" });
    },
  });

  komite.saran_tindakan.forEach((saran, index) => {
    const lines: string[] = doc.splitTextToSize(`${index + 1}. ${saran}`, innerW - 2);
    items.push({
      height: lines.length * 3.9,
      draw: (f, top) => {
        f.doc.setFont("helvetica", "normal");
        f.doc.setFontSize(7.2);
        setColor(f.doc, BODY);
        lines.forEach((line, lineIndex) => {
          f.doc.text(line, innerX, top + (lineIndex + 1) * 3.9);
        });
      },
    });
  });

  komite.syarat_khusus.forEach((syarat) => {
    const lines: string[] = doc.splitTextToSize(`• ${syarat}`, innerW - 2);
    items.push({
      height: lines.length * 3.7,
      draw: (f, top) => {
        f.doc.setFont("helvetica", "italic");
        f.doc.setFontSize(7);
        setColor(f.doc, theme.text);
        lines.forEach((line, lineIndex) => {
          f.doc.text(line, innerX + 2, top + (lineIndex + 1) * 3.7);
        });
      },
    });
  });

  if (komite.saran_tindakan.length === 0 && komite.syarat_khusus.length === 0) {
    items.push({
      height: 4.2,
      draw: (f, top) => {
        f.doc.setFont("helvetica", "italic");
        f.doc.setFontSize(7.2);
        setColor(f.doc, MUTED);
        f.doc.text("Tidak ada saran tindakan / syarat khusus yang dicatat pada laporan.", innerX, top + 3.5);
      },
    });
  }

  void title;
  return items;
}

/**
 * Menggambar kotak berisi sejumlah item, memindahkan sisa item ke halaman
 * berikutnya (dengan label "lanjutan") bila tidak muat dalam satu halaman.
 */
function drawBoxWithItems(
  flow: Flow,
  runningTitle: string,
  options: { title: string; fill: RGB; border: RGB; titleColor: RGB; items: BoxItem[] }
) {
  const padTop = 9;
  const padBottom = 4;
  const headerH = padTop;

  let index = 0;
  let isContinuation = false;

  while (index < options.items.length) {
    const available = BOTTOM_LIMIT - flow.y;
    let used = headerH;
    const take: BoxItem[] = [];

    for (let i = index; i < options.items.length; i += 1) {
      const item = options.items[i];
      if (used + item.height + padBottom > available && take.length > 0) break;
      take.push(item);
      used += item.height;
    }

    if (take.length === 0) {
      // Satu item saja lebih tinggi dari satu halaman penuh — paksa ke halaman baru.
      addPage(flow, runningTitle);
      continue;
    }

    const boxH = used + padBottom;
    const doc = flow.doc;

    doc.setFillColor(options.fill[0], options.fill[1], options.fill[2]);
    doc.setDrawColor(options.border[0], options.border[1], options.border[2]);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_X, flow.y, CONTENT_W, boxH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setColor(doc, options.titleColor);
    doc.text(
      isContinuation ? `${options.title} (lanjutan)` : options.title,
      MARGIN_X + 4,
      flow.y + 6
    );

    let cursorY = flow.y + headerH;
    for (const item of take) {
      item.draw(flow, cursorY);
      cursorY += item.height;
    }

    flow.y += boxH + 5;
    index += take.length;
    isContinuation = true;

    if (index < options.items.length) addPage(flow, runningTitle);
  }
}

/* ------------------------------ Entry points ---------------------------- */

export function slikReportFileName(data: SlikAnalysis): string {
  const nama = (data.data_pribadi.nama_lengkap || "Debitur").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return `Laporan_Analisa_SLIK_OJK_-_${nama || "Debitur"}.pdf`;
}

/**
 * Membangun dokumen laporan (2 halaman + halaman lanjutan bila diperlukan).
 */
export async function buildSlikReportPdf(data: SlikAnalysis): Promise<PdfDoc> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ format: "a4", unit: "mm", orientation: "portrait" });
  const runnerTitle = `Debitur: ${data.data_pribadi.nama_lengkap}`;
  const flow: Flow = { doc, y: TOP_Y };

  /* ================= HALAMAN 1: identitas & fasilitas ================= */
  drawCoverHeader(doc, data);
  flow.y = 32;

  drawInfoPanels(flow, data);

  sectionHeading(flow, "1. Pengelompokan & Rincian Fasilitas Kredit Debitur", runnerTitle, { spaceBefore: 0 });
  drawFasilitasTable(flow, data, autoTable as unknown as (doc: PdfDoc, options: object) => void);
  drawTunggakanBox(flow, data);

  /* ================= HALAMAN 2: analisis & rekomendasi ================ */
  addPage(flow, runnerTitle);
  flow.y = 18;

  subHeading(flow, "2. PERHITUNGAN ANGSURAN & REKOMENDASI ANALIS KREDIT", runnerTitle);

  // A. Angsuran berjalan
  subHeading(flow, "A. Analisis Angsuran Berjalan & Total Tanggungan Bulanan", runnerTitle);

  const angsuran = data.analisis_dan_rekomendasi.ringkasan_angsuran ?? [];
  if (angsuran.length === 0) {
    paragraph(flow, "Tidak ada fasilitas angsuran berjalan yang terdeteksi.", {
      fontSize: 7.5,
      color: MUTED,
      runningTitle: runnerTitle,
      spaceAfter: 2,
    });
  } else {
    angsuran.forEach((item, index) => {
      ensureSpace(flow, 12, runnerTitle);
      flow.y += 2;
      paragraph(flow, `${index + 1}. ${item.nama_bank}`, {
        x: MARGIN_X + 2,
        fontSize: 7.8,
        bold: true,
        lineHeight: 4.4,
        runningTitle: runnerTitle,
      });
      const detailLines: string[] = doc.splitTextToSize(item.detail, CONTENT_W - 60);
      paragraph(flow, detailLines.join("\n"), {
        x: MARGIN_X + 6,
        width: CONTENT_W - 60,
        fontSize: 7.2,
        lineHeight: 4,
        color: MUTED,
        runningTitle: runnerTitle,
      });
      // Nilai angsuran diratakan kanan pada baris pertama detail.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, NAVY);
      doc.text(item.nominal_per_bulan, PAGE_W - MARGIN_X, flow.y - 4 * (detailLines.length - 1), {
        align: "right",
      });
    });
  }

  // Banner total angsuran
  const totalText = data.analisis_dan_rekomendasi.total_estimasi_angsuran_bulanan || "Rp 0/bulan";
  ensureSpace(flow, 12, runnerTitle);
  flow.y += 2;
  const bannerH = 8;
  doc.setFillColor(PANEL[0], PANEL[1], PANEL[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN_X, flow.y, CONTENT_W, bannerH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setColor(doc, DARK);
  doc.text("TOTAL ESTIMASI BEBAN ANGSURAN BULANAN (ACTIVE OBLIGATION)", MARGIN_X + 4, flow.y + 5.2);
  doc.setFontSize(8.5);
  setColor(doc, NAVY);
  doc.text(totalText, PAGE_W - MARGIN_X - 4, flow.y + 5.2, { align: "right" });
  flow.y += bannerH + 4;

  // B. Inventarisasi agunan
  subHeading(flow, "B. Inventarisasi Agunan Tercatat pada Fasilitas Eksisting", runnerTitle);
  const agunan = data.analisis_dan_rekomendasi.inventarisasi_agunan ?? [];
  if (agunan.length === 0) {
    paragraph(flow, "Tidak ada data agunan yang tercatat.", {
      fontSize: 7.5,
      color: MUTED,
      runningTitle: runnerTitle,
    });
  } else {
    agunan.forEach((item) => {
      paragraph(flow, `• ${item}`, {
        x: MARGIN_X + 2,
        width: CONTENT_W - 4,
        fontSize: 7.5,
        lineHeight: 4.2,
        runningTitle: runnerTitle,
      });
    });
  }
  ensureSpace(flow, 6, runnerTitle);
  flow.y += 3;

  // C. Catatan kritis karakter
  subHeading(flow, "C. Catatan Kritis Karakter & Kapasitas Debitur", runnerTitle);
  const catatan = data.analisis_dan_rekomendasi.catatan_kritis_karakter ?? [];
  if (catatan.length === 0) {
    paragraph(flow, "Tidak ada catatan kritis yang diidentifikasi.", {
      fontSize: 7.5,
      color: MUTED,
      runningTitle: runnerTitle,
    });
  } else {
    catatan.forEach((item) => {
      const titleText = `• ${item.judul}: `;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      const titleWidth = doc.getTextWidth(titleText);
      const uraianWidth = Math.max(CONTENT_W - 4 - titleWidth, 40);
      const uraianLines: string[] = doc.splitTextToSize(item.uraian, uraianWidth);

      ensureSpace(flow, 5 + uraianLines.length * 4.2, runnerTitle);
      flow.y += 4.4;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, DARK);
      doc.text(titleText, MARGIN_X + 2, flow.y);

      doc.setFont("helvetica", "normal");
      setColor(doc, BODY);
      uraianLines.forEach((line, index) => {
        if (index > 0) {
          if (flow.y + 4.2 > BOTTOM_LIMIT) addPage(flow, runnerTitle);
          flow.y += 4.2;
        }
        doc.text(line, MARGIN_X + 2 + titleWidth, flow.y);
      });
      flow.y += 1;
    });
  }
  ensureSpace(flow, 6, runnerTitle);
  flow.y += 4;

  // Kotak keputusan komite
  const theme = decisionTheme(data.analisis_dan_rekomendasi.keputusan_komite.rekomendasi);
  const items = buildDecisionItems(flow, data, "KEPUTUSAN KOMITE / ANALIS KREDIT");
  drawBoxWithItems(flow, runnerTitle, {
    title: "KEPUTUSAN KOMITE / ANALIS KREDIT",
    fill: theme.fill,
    border: theme.border,
    titleColor: theme.text,
    items,
  });

  stampFooters(doc, data);
  return doc;
}

function stampFooters(doc: PdfDoc, data: SlikAnalysis) {
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, FOOTER_Y - 4, PAGE_W - MARGIN_X, FOOTER_Y - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(doc, MUTED);
    doc.text(`Laporan Analisa SLIK OJK Debitur: ${data.data_pribadi.nama_lengkap}`, MARGIN_X, FOOTER_Y);
    doc.text(`Halaman ${page} dari ${totalPages}`, PAGE_W - MARGIN_X, FOOTER_Y, { align: "right" });
  }
}

/** Membangun lalu mengunduh laporan ke perangkat pengguna. */
export async function downloadSlikReportPdf(data: SlikAnalysis): Promise<string> {
  const doc = await buildSlikReportPdf(data);
  const fileName = slikReportFileName(data);
  doc.save(fileName);
  return fileName;
}

export const SLIK_REPORT_PAGE = { width: PAGE_W, height: PAGE_H, marginX: MARGIN_X };
