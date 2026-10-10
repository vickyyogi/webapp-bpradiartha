/**
 * Harness verifikasi generator laporan SLIK (dijalankan dengan ts-node, bukan bagian aplikasi).
 * Tujuan: membuktikan tidak ada konten yang menabrak/melampaui area halaman
 * (masalah utama pada contoh kode di docs/slik-analyzer.md).
 */
import * as fs from "fs";
import * as path from "path";
import { buildSlikReportPdf, slikReportFileName } from "../src/lib/slik/generateSlikReport";
import { normalizeSlikAnalysis, type SlikAnalysis } from "../src/lib/slik/types";

declare const require: (id: string) => unknown;
const pdfParse = require("pdf-parse-fork") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

/** Potongan API instance jsPDF yang dipakai harness ini. */
interface PdfPageInfo {
  pageNumber: number;
}
interface PdfInstanceLike {
  getCurrentPageInfo: () => PdfPageInfo;
  text: (...args: unknown[]) => unknown;
  rect: (...args: unknown[]) => unknown;
}
type PdfConstructor = new (...args: unknown[]) => PdfInstanceLike;

interface Tracked {
  page: number;
  textYs: number[];
  maxTextY: number;
  maxRectY: number;
  textCalls: number;
}

const tracked: Tracked[] = [];

function track(doc: PdfInstanceLike, y: number, kind: "text" | "rect") {
  const page = doc.getCurrentPageInfo().pageNumber;
  let entry = tracked.find((t) => t.page === page);
  if (!entry) {
    entry = { page, textYs: [], maxTextY: 0, maxRectY: 0, textCalls: 0 };
    tracked.push(entry);
  }
  if (kind === "text") {
    entry.textYs.push(y);
    entry.maxTextY = Math.max(entry.maxTextY, y);
    entry.textCalls += 1;
  } else {
    entry.maxRectY = Math.max(entry.maxRectY, y);
  }
}

// jsPDF v4 menaruh text()/rect() sebagai own property tiap instance, jadi yang
// dipatch adalah subclass konstruktornya. Generator memanggil `await import("jspdf")`,
// sehingga modul yang sama (require cache) akan mengambil subclass ini.
const jspdfModule = require("jspdf") as { jsPDF: PdfConstructor };
const RealJsPDF = jspdfModule.jsPDF;

class TrackedJsPDF extends RealJsPDF {
  constructor(...args: unknown[]) {
    super(...args);
    const originalText = this.text.bind(this);
    this.text = (...callArgs: unknown[]) => {
      const rawY = callArgs[2];
      const y = typeof rawY === "number" ? rawY : Array.isArray(rawY) ? Math.max(...(rawY as number[])) : 0;
      track(this, y, "text");
      return originalText(...callArgs);
    };
    const originalRect = this.rect.bind(this);
    this.rect = (...callArgs: unknown[]) => {
      const [x, rectY, , rectH] = callArgs;
      const y = typeof rectY === "number" ? rectY + (typeof rectH === "number" ? rectH : 0) : 0;
      void x;
      track(this, y, "rect");
      return originalRect(...callArgs);
    };
  }
}
jspdfModule.jsPDF = TrackedJsPDF as unknown as PdfConstructor;

function buildSample(): SlikAnalysis {
  const raw = {
    header: { nomor_laporan: "SLIK-2026-000123", posisi_data: "31 Agustus 2026", operator: "AO Cabang Utama" },
    data_pribadi: {
      nama_lengkap: "I Wayan Sudarma Putra",
      nik: "5171012508850003",
      ttl_usia: "Denpasar, 25 Agustus 1985 / 41 Tahun",
      pekerjaan: "Wiraswasta - Perdagangan Sembako",
      pendidikan: "S1 Ekonomi",
    },
    ringkasan_eksposur: {
      total_baki_debet: "1.750.500.000",
      plafon_efektif: "Rp 2.000.000.000",
      kualitas_terburuk: "Kolektibilitas 2 (DPK)",
      total_kreditur: "4 Lembaga",
      total_fasilitas: "5 Fasilitas",
    },
    rincian_tunggakan: {
      tunggakan_pokok: "12.500.000",
      tunggakan_bunga: "875.000",
      denda_berjalan: "250.000",
      total_tunggakan_real: "13.625.000",
    },
    fasilitas: [
      {
        bank_pelapor: "PT BPR Adiartha Reksacitra",
        jenis_fasilitas: "Kredit Modal Kerja",
        plafon_awal: 500000000,
        baki_debet: 320000000,
        suku_bunga: "12,5% p.a",
        kolektibilitas: "2",
        hari_tunggakan: 45,
        status_kondisi: "Aktif",
        est_angsuran_bulan: 12500000,
        catatan_khusus: "Tunggakan 1 bulan",
      },
      {
        bank_pelapor: "Bank Rakyat Indonesia (Persero) Tbk",
        jenis_fasilitas: "Kredit Usaha Rakyat",
        plafon_awal: 250000000,
        baki_debet: 180500000,
        suku_bunga: "9% p.a",
        kolektibilitas: "1",
        hari_tunggakan: 0,
        status_kondisi: "Aktif",
        est_angsuran_bulan: 4200000,
        catatan_khusus: "",
      },
      {
        bank_pelapor: "PT Bank Mandiri (Persero) Tbk",
        jenis_fasilitas: "Kredit Investasi",
        plafon_awal: 1200000000,
        baki_debet: 1150000000,
        suku_bunga: "11% p.a",
        kolektibilitas: "1",
        hari_tunggakan: 0,
        status_kondisi: "Aktif",
        est_angsuran_bulan: 21000000,
        catatan_khusus: "Agunan SHM no 1123",
      },
      {
        bank_pelapor: "PT Bank Perkreditan Rakyat Bali",
        jenis_fasilitas: "Kredit Modal Kerja",
        plafon_awal: 150000000,
        baki_debet: 100000000,
        suku_bunga: "14% p.a",
        kolektibilitas: "5",
        hari_tunggakan: 420,
        status_kondisi: "Dihapus Buku",
        est_angsuran_bulan: 0,
        catatan_khusus: "Hapus buku 2024",
      },
    ],
    analisis_dan_rekomendasi: {
      ringkasan_angsuran: [
        { nama_bank: "PT BPR Adiartha Reksacitra", detail: "KMK tenor 48 bulan, sisa 26 bulan", nominal_per_bulan: "Rp 12.500.000" },
        { nama_bank: "Bank Rakyat Indonesia", detail: "KUR tenor 36 bulan, sisa 12 bulan", nominal_per_bulan: "Rp 4.200.000" },
        { nama_bank: "PT Bank Mandiri (Persero) Tbk", detail: "KI tenor 60 bulan, sisa 42 bulan", nominal_per_bulan: "Rp 21.000.000" },
      ],
      total_estimasi_angsuran_bulanan: "Rp 37.700.000/bulan",
      inventarisasi_agunan: [
        "SHM No. 1123/Desa Pemecutan (atas nama debitur) — Bank Mandiri",
        "BPKB Toyota Avanza 2020 (BPKB ditahan BRI)",
      ],
      catatan_kritis_karakter: [
        { judul: "Riwayat Tunggakan Berjalan", uraian: "Terdapat tunggakan 45 hari pada fasilitas KMK BPR dan satu fasilitas hapus buku pada BPR lain sejak 2024." },
        { judul: "Kapasitas Bayar (DSR)", uraian: "Total angsuran bulanan berjalan terhadap estimasi pendapatan usaha menunjukkan DSR 42%, di atas ambang aman internal 35%." },
        { judul: "Kolektibilitas Terburuk", uraian: "Kualitas terburuk Kolektibilitas 5 (hapus buku) atas nama debitur pada lembaga lain." },
      ],
      keputusan_komite: {
        rekomendasi: "REJECT",
        risk_rating: "HIGH RISK",
        saran_tindakan: [
          "Tolak pengajuan kredit baru sampai fasilitas hapus buku pada BPR lain diselesaikan.",
          "Minta bukti pelunasan tunggakan 45 hari pada fasilitas KMK BPR.",
          "Lakukan verifikasi ulang kapasitas bayar dengan rekening koran 6 bulan terakhir.",
        ],
        syarat_khusus: ["Wajib penambahan agunan SHM bila ingin diajukan kembali.", "Blokir pelunasan dipercepat."],
      },
    },
  };
  return normalizeSlikAnalysis(raw).data;
}

function buildStress(): SlikAnalysis {
  const base = buildSample();
  return {
    ...base,
    data_pribadi: {
      ...base.data_pribadi,
      nama_lengkap: "Nama Debitur Dengan Panjang Sekali Untuk Menguji Pembungkusan Teks Pada Sel Tabel dan Judul Laporan Resmi",
    },
    fasilitas: Array.from({ length: 34 }, (_, i) => ({
      bank_pelapor: `Bank Pelapor Ke-${i + 1} Dengan Nama Institusi Yang Cukup Panjang`,
      jenis_fasilitas: "Kredit Modal Kerja Investasi Sindikasi",
      plafon_awal: 250000000 + i * 10000000,
      baki_debet: 150000000 + i * 5000000,
      suku_bunga: `${10 + (i % 5)}% p.a`,
      kolektibilitas: String((i % 5) + 1),
      hari_tunggakan: i * 30,
      status_kondisi: i % 3 === 0 ? "Dihapus Buku" : "Aktif",
      est_angsuran_bulan: 5000000 + i * 100000,
      catatan_khusus: "Agunan SHM banyak",
    })),
    analisis_dan_rekomendasi: {
      ...base.analisis_dan_rekomendasi,
      ringkasan_angsuran: Array.from({ length: 12 }, (_, i) => ({
        nama_bank: `Bank ${i + 1}`,
        detail: "Detail fasilitas dengan uraian panjang ".repeat(4),
        nominal_per_bulan: `Rp ${(i + 1) * 1500000}`,
      })),
      inventarisasi_agunan: Array.from({ length: 14 }, (_, i) => `Agunan ${i + 1}: ${"uraian panjang ".repeat(9)}`),
      catatan_kritis_karakter: Array.from({ length: 10 }, (_, i) => ({
        judul: `Catatan ${i + 1}`,
        uraian: `${"Penjelasan panjang tanpa spasi panjangnya sedang. ".repeat(6)}`,
      })),
      keputusan_komite: {
        rekomendasi: "CONSIDER",
        risk_rating: "VERY HIGH RISK",
        saran_tindakan: Array.from({ length: 9 }, (_, i) => `Saran tindakan ${i + 1}: ${"uraian ".repeat(12)}`),
        syarat_khusus: Array.from({ length: 8 }, (_, i) => `Syarat khusus ${i + 1}: ${"syarat ".repeat(10)}`),
      },
    },
  };
}

async function run(label: string, data: SlikAnalysis) {
  tracked.length = 0;
  const doc = await buildSlikReportPdf(data);
  const pages = doc.getNumberOfPages();
  const outDir = process.env.OUT_DIR || ".";
  const outPath = path.join(outDir, slikReportFileName(data));
  const buffer = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  fs.writeFileSync(outPath, buffer);

  // Semua teks selain footer harus berada di dalam area isi (<= 282 mm).
  const bodyYs = tracked.flatMap((t) => t.textYs).filter((y) => y <= 285);
  const worstBody = bodyYs.length > 0 ? Math.max(...bodyYs) : 0;
  const footerYs = tracked.flatMap((t) => t.textYs).filter((y) => y > 285);
  const worstRect = Math.max(...tracked.map((t) => t.maxRectY));
  const textCalls = tracked.reduce((sum, t) => sum + t.textCalls, 0);
  const perPageBody = tracked
    .map((t) => {
      const values = t.textYs.filter((y) => y <= 285);
      return `p${t.page}: ${values.length > 0 ? Math.max(...values).toFixed(1) : "-"}`;
    })
    .join(" | ");

  console.log(`\n=== ${label} ===`);
  console.log(`halaman      : ${pages}`);
  console.log(`file         : ${outPath} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
  console.log(`teks tertulis: ${textCalls} panggilan (${footerYs.length} untuk footer)`);
  console.log(`maxY isi/hal : ${perPageBody}`);
  console.log(`maxY isi     : ${worstBody.toFixed(2)} mm  (batas area isi = 282 mm, footer = 288 mm)`);
  console.log(`maxY kotak   : ${worstRect.toFixed(2)} mm  (batas halaman 297 mm)`);

  // Verifikasi silang: baca ulang PDF hasilnya memakai pdf-parse-fork
  // (paket yang sama yang dipakai API route saat menerima unggahan).
  const extracted = await pdfParse(buffer);
  const text = extracted.text.replace(/\s+/g, " ");
  const expectations: Array<[string, boolean]> = [
    ["jumlah halaman terbaca ulang", extracted.numpages === pages],
    ["nomor laporan muncul", text.includes(data.header.nomor_laporan)],
    ["nama debitur muncul", text.includes(data.data_pribadi.nama_lengkap.slice(0, 25))],
    ["judul CREDIT RISK ASSESSMENT", text.includes("CREDIT RISK ASSESSMENT")],
    ["bagian keputusan komite", /KEPUTUSAN KOMITE/i.test(text)],
    ["rekomendasi tercetak", text.includes(data.analisis_dan_rekomendasi.keputusan_komite.rekomendasi)],
    ["nomor halaman dinamis", new RegExp(`Halaman 1 dari ${pages}`).test(text)],
  ];
  for (const [name, ok] of expectations) {
    console.log(`  ${ok ? "OK  " : "GAGAL"} ${name}`);
  }

  const overflows: string[] = [];
  if (worstBody > 282.01) overflows.push(`badan teks melewati batas isi: ${worstBody.toFixed(1)} mm`);
  if (worstRect > 292) overflows.push(`kotak melewati halaman: ${worstRect.toFixed(1)} mm`);
  if (textCalls < 40) overflows.push(`teks terlalu sedikit (${textCalls}) — ada bagian yang tidak tergambar`);
  for (const [name, ok] of expectations) {
    if (!ok) overflows.push(`verifikasi isi gagal: ${name}`);
  }

  if (overflows.length > 0) {
    console.log(`HASIL: GAGAL -> ${overflows.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log("HASIL: OK (tidak ada konten menabrak footer; isi terbaca ulang sesuai harapan)");
  }
  return outPath;
}

async function main() {
  await run("DATA NORMAL", buildSample());
  await run("DATA STRESS (34 fasilitas, uraian panjang)", buildStress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
