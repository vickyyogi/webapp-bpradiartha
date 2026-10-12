/**
 * Uji LANGSUNG (live) jalur OpenRouter untuk analisa SLIK.
 *
 * Berbeda dengan `verify-slik-logic.ts` (tanpa jaringan), skrip ini benar-benar
 * memanggil OpenRouter memakai OPENROUTER_API_KEY dari .env, memakai data SLIK
 * SINTETIS (bukan data debitur nyata), dan memakan sedikit kuota token.
 *
 * Jalankan: npm run verify:slik:live
 */
import {
  analyzeSlikDocuments,
  analyzeSlikPerDocument,
  MAX_PROMPT_DOC_CHARS,
  type SlikSourceText,
} from "../src/lib/slik/openrouter";
import { buildSlikReportBundlePdf, slikBundleReportFileName } from "../src/lib/slik/generateSlikReport";

/** Teks SLIK buatan — sengaja jelas-jelas data uji, bukan debitur sungguhan. */
const TEKS_SLIK_SINTETIS = `
LAPORAN SLIK OJK - IDEB (DATA UJI OTOMATIS, BUKAN DEBITUR NYATA)
Nomor Laporan    : SLIK-UJI-2026-000001
Tanggal Posisi   : 31 Agustus 2026
Operator         : SISTEM UJI OTOMATIS

IDENTITAS DEBITUR
Nama             : DEBITUR CONTOH PENGUJIAN
NIK              : 5171010101900001
Tempat/Tgl Lahir : Denpasar, 01 Januari 1990
Usia             : 36 Tahun
Pekerjaan        : Karyawan Swasta
Pendidikan      : S1

RINGKASAN FASILITAS
Total Fasilitas  : 2
Total Baki Debet : Rp 175.000.000
Kualitas Terburuk: Kolektibilitas 2 (Dalam Perhatian Khusus)

DETAIL FASILITAS
1. PT BPR CONTOH SENTOSA
   Jenis Fasilitas : Kredit Modal Kerja
   Plafon Awal     : Rp 200.000.000
   Baki Debet      : Rp 150.000.000
   Suku Bunga      : 12,5% p.a
   Kolektibilitas  : 2
   Hari Tunggakan  : 45 hari
   Kondisi         : Aktif
   Agunan          : SHM No. 1234/Desa Uji

2. PT BANK CONTOH NASIONAL TBK
   Jenis Fasilitas : Kredit Investasi
   Plafon Awal     : Rp 50.000.000
   Baki Debet      : Rp 25.000.000
   Suku Bunga      : 10% p.a
   Kolektibilitas  : 1
   Hari Tunggakan  : 0 hari
   Kondisi         : Aktif
   Agunan          : BPKB Motor Honda Vario 2021

TUNGGAKAN
Tunggakan Pokok : Rp 5.000.000
Tunggakan Bunga : Rp 250.000
Denda Berjalan  : Rp 75.000
`;

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (!ok) failures += 1;
  console.log(`${ok ? "OK  " : "GAGAL"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
}

/**
 * Uji mode "pisah per berkas": dua PDF dengan debitur BERBEDA harus menghasilkan
 * dua analisa terpisah (dua laporan), bukan satu analisa gabungan. Ini perilaku
 * yang sebelumnya salah: prompt lama memaksa "debitur yang sama".
 */
async function ujiPerBerkas(): Promise<void> {
  console.log("\n---- MODE PISAH PER BERKAS (2 debitur berbeda) ----");

  const debiturKedua = TEKS_SLIK_SINTETIS.replace(/DEBITUR CONTOH PENGUJIAN/g, "DEBITUR CONTOH KEDUA")
    .replace("SLIK-UJI-2026-000001", "SLIK-UJI-2026-000002")
    .replace("5171010101900001", "5171010202880002")
    .replace("Rp 175.000.000", "Rp 60.000.000")
    .replace("Rp 150.000.000", "Rp 40.000.000")
    .replace("Rp 200.000.000", "Rp 90.000.000")
    .replace("Rp 25.000.000", "Rp 20.000.000")
    .replace("Rp 50.000.000", "Rp 30.000.000");

  const sources: SlikSourceText[] = [
    { fileName: "slik-debitur-pertama.pdf", pages: 1, text: TEKS_SLIK_SINTETIS, truncated: false },
    { fileName: "slik-debitur-kedua.pdf", pages: 1, text: debiturKedua, truncated: false },
  ];

  const started = Date.now();
  const results = await analyzeSlikPerDocument(sources, 2);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  for (const item of results) {
    console.log(
      `  ${item.ok ? "OK " : "GAGAL"} ${item.fileName}: ${
        item.ok
          ? `${item.data!.data_pribadi.nama_lengkap} | ${item.data!.header.nomor_laporan} | ${item.data!.ringkasan_eksposur.total_baki_debet} | ${item.data!.analisis_dan_rekomendasi.keputusan_komite.rekomendasi}`
          : item.error
      }`
    );
  }
  console.log(`  durasi: ${elapsed} detik`);

  check("dua berkas menghasilkan dua hasil", results.length === 2, String(results.length));
  check("kedua berkas berhasil dianalisa", results.every((item) => item.ok), results.map((i) => i.error).join(" | "));
  check("hasil urut sesuai urutan unggah", results[0].fileName === "slik-debitur-pertama.pdf" && results[1].fileName === "slik-debitur-kedua.pdf");
  check(
    "debitur pertama tetap debitur pertama",
    /PENGUJIAN/i.test(results[0].data?.data_pribadi.nama_lengkap ?? ""),
    results[0].data?.data_pribadi.nama_lengkap
  );
  check(
    "debitur kedua TIDAK tercampur debitur pertama",
    /KEDUA/i.test(results[1].data?.data_pribadi.nama_lengkap ?? ""),
    results[1].data?.data_pribadi.nama_lengkap
  );
  check(
    "kedua analisa punya nomor laporan berbeda",
    results[0].data?.header.nomor_laporan !== results[1].data?.header.nomor_laporan,
    `${results[0].data?.header.nomor_laporan} vs ${results[1].data?.header.nomor_laporan}`
  );
  check(
    "angka tiap debitur tidak tertukar",
    results[0].data?.ringkasan_eksposur.total_baki_debet === 175_000_000 &&
      results[1].data?.ringkasan_eksposur.total_baki_debet === 60_000_000,
    `${results[0].data?.ringkasan_eksposur.total_baki_debet} / ${results[1].data?.ringkasan_eksposur.total_baki_debet}`
  );

  // PDF hasil model nyata harus bisa disusun menjadi satu berkas berisi dua laporan.
  const entries = results
    .filter((item) => item.ok && item.data)
    .map((item) => ({ fileName: item.fileName, data: item.data! }));
  const doc = await buildSlikReportBundlePdf(entries);
  const pages = doc.getNumberOfPages();
  console.log(`  PDF bundel: ${slikBundleReportFileName(entries)} — ${pages} halaman (termasuk 1 halaman daftar debitur)`);
  check("bundel berisi 1 halaman daftar + laporan tiap debitur", pages >= 5, String(pages));
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.log("DILEWATI: OPENROUTER_API_KEY belum diset (jalankan dengan .env yang memuat kunci).");
    return;
  }

  console.log("Memanggil OpenRouter dengan data SLIK sintetis...\n");

  let result: Awaited<ReturnType<typeof analyzeSlikDocuments>>;
  try {
    result = await analyzeSlikDocuments([
      { fileName: "slik-uji-sintetis.pdf", pages: 1, text: TEKS_SLIK_SINTETIS, truncated: false },
    ]);
  } catch (error) {
    failures += 1;
    console.log(`GAGAL panggilan OpenRouter: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  const { data, model, elapsedMs, warnings } = result;
  const komite = data.analisis_dan_rekomendasi.keputusan_komite;

  console.log(`model terpakai     : ${model}`);
  console.log(`durasi             : ${(elapsedMs / 1000).toFixed(1)} detik`);
  console.log(`peringatan         : ${warnings.length}${warnings.length ? ` -> ${warnings.join(" | ")}` : ""}`);
  console.log("");
  console.log(`nama debitur       : ${data.data_pribadi.nama_lengkap}`);
  console.log(`nik                : ${data.data_pribadi.nik}`);
  console.log(`nomor laporan      : ${data.header.nomor_laporan}`);
  console.log(`total baki debet   : ${data.ringkasan_eksposur.total_baki_debet}`);
  console.log(`jumlah fasilitas   : ${data.fasilitas.length}`);
  console.log(`angsuran bulanan   : ${data.analisis_dan_rekomendasi.total_estimasi_angsuran_bulanan}`);
  console.log(`rekomendasi        : ${komite.rekomendasi} / ${komite.risk_rating}`);
  console.log(`catatan kritis     : ${data.analisis_dan_rekomendasi.catatan_kritis_karakter.length}`);
  console.log("");

  const rekomendasiValid = ["REJECT", "APPROVE", "CONSIDER"].includes(komite.rekomendasi);
  const totalBaki = data.ringkasan_eksposur.total_baki_debet;

  check("respons berhasil dinormalisasi jadi satu objek", typeof data === "object" && data !== null);
  check("nama debitur terbaca", /contoh/i.test(data.data_pribadi.nama_lengkap), data.data_pribadi.nama_lengkap);
  check("NIK terbaca", data.data_pribadi.nik.replace(/\D/g, "").length >= 16, data.data_pribadi.nik);
  check("2 fasilitas terekstrak", data.fasilitas.length === 2, `diperoleh ${data.fasilitas.length}`);
  check(
    "nominal teks 'Rp 150.000.000' jadi angka",
    data.fasilitas.some((f) => f.baki_debet === 150_000_000),
    JSON.stringify(data.fasilitas.map((f) => f.baki_debet))
  );
  check("hari tunggakan '45 hari' jadi angka 45", data.fasilitas.some((f) => f.hari_tunggakan === 45));
  check("total baki debet masuk akal (>0)", totalBaki > 0, String(totalBaki));
  check("rekomendasi termasuk nilai yang diizinkan", rekomendasiValid, komite.rekomendasi);
  check("saran tindakan terisi", komite.saran_tindakan.length > 0);
  check("tidak ada peringatan normalisasi", warnings.filter((w) => w.includes("tidak ditemukan") || w.includes("tidak dikenal")).length === 0);

  const promptChars = TEKS_SLIK_SINTETIS.length;
  check(
    `ukuran teks uji jauh di bawah batas kuota (${promptChars} < ${MAX_PROMPT_DOC_CHARS})`,
    promptChars < MAX_PROMPT_DOC_CHARS
  );

  // Mode utama fitur ini: satu berkas = satu debitur = satu laporan.
  await ujiPerBerkas();

  console.log(`\n${failures === 0 ? "UJI LIVE LULUS" : `${failures} UJI LIVE GAGAL`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
