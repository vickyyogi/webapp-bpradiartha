/**
 * Uji logika murni analyza SLIK: parsing angka format Indonesia, kebersihan JSON
 * dari model, dan normalisasi hasil ekstraksi. Tidak memanggil API apa pun.
 *
 * Jalankan: npm run verify:slik
 */
import { extractJsonPayload, buildSlikUserPrompt } from "../src/lib/slik/openrouter";
import { normalizeSlikAnalysis, parseNumeric, formatRupiah } from "../src/lib/slik/types";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "OK  " : "GAGAL"} ${name}${ok ? "" : `\n     diharapkan: ${JSON.stringify(expected)}\n     diperoleh : ${JSON.stringify(actual)}`}`);
}

/* ---------- parseNumeric: format angka Indonesia ---------- */
check("parseNumeric '1.500.000'", parseNumeric("1.500.000"), 1500000);
check("parseNumeric 'Rp 1.750.500.000'", parseNumeric("Rp 1.750.500.000"), 1750500000);
check("parseNumeric '12,5%'", parseNumeric("12,5%"), 12.5);
check("parseNumeric '1.234,56'", parseNumeric("1.234,56"), 1234.56);
check("parseNumeric '250 juta'", parseNumeric("250 juta"), 250);
check("parseNumeric null", parseNumeric(null), 0);
check("parseNumeric 4200000", parseNumeric(4200000), 4200000);
check("formatRupiah 1750500000", formatRupiah(1750500000), "Rp 1.750.500.000");
check("formatRupiah undefined", formatRupiah(undefined), "Rp 0");

/* ---------- extractJsonPayload ---------- */
check(
  "buang pagar markdown ```json",
  extractJsonPayload('```json\n{"a":1}\n```'),
  '{"a":1}'
);
check(
  "buang kalimat pembuka/penutup",
  extractJsonPayload('Berikut hasilnya:\n{"a":1}\nSemoga membantu!'),
  '{"a":1}'
);
check("JSON sudah bersih", extractJsonPayload('{"a":1}'), '{"a":1}');

/* ---------- normalizeSlikAnalysis ---------- */
const messy = {
  header: { nomor_laporan: 12345 },
  data_pribadi: { nama_lengkap: "  Budi  ", nik: 5171012508850003 },
  ringkasan_eksposur: { total_baki_debet: "Rp 1.500.000.000" },
  rincian_tunggakan: { tunggakan_pokok: "12.500.000", total_tunggakan_real: null },
  fasilitas: [
    {
      bank_pelapor: "BPR X",
      jenis_fasilitas: "KMK",
      plafon_awal: "500.000.000",
      baki_debet: 320000000,
      kolektibilitas: 2,
      hari_tunggakan: "45 hari",
      status_kondisi: null,
      est_angsuran_bulan: "12.500.000",
      catatan_khusus: null,
    },
    "bukan objek",
  ],
  analisis_dan_rekomendasi: {
    ringkasan_angsuran: [{ nama_bank: "BPR X", detail: null, nominal_per_bulan: "Rp 12.500.000" }],
    inventarisasi_agunan: "SHM 1123\nBPKB Avanza",
    catatan_kritis_karakter: [{ judul: "Tunggakan", uraian: "45 hari" }],
    keputusan_komite: {
      rekomendasi: "tolak",
      saran_tindakan: ["Tolak"],
      syarat_khusus: null,
    },
  },
};

const { data, issues } = normalizeSlikAnalysis(messy);
check("nomor_laporan angka -> string", data.header.nomor_laporan, "12345");
check("nama_lengkap di-trim", data.data_pribadi.nama_lengkap, "Budi");
check("nik angka -> string", data.data_pribadi.nik, "5171012508850003");
check("total_baki_debet teks -> number", data.ringkasan_eksposur.total_baki_debet, 1500000000);
check("tunggakan_pokok teks -> number", data.rincian_tunggakan.tunggakan_pokok, 12500000);
check("total_tunggakan_real null -> 0", data.rincian_tunggakan.total_tunggakan_real, 0);
check("item fasilitas non-objek dibuang", data.fasilitas.length, 1);
check("kolektibilitas angka -> '2'", data.fasilitas[0].kolektibilitas, "2");
check("hari_tunggakan '45 hari' -> 45", data.fasilitas[0].hari_tunggakan, 45);
check("status_kondisi null -> 'Aktif'", data.fasilitas[0].status_kondisi, "Aktif");
check("string agunan dipisah newline", data.analisis_dan_rekomendasi.inventarisasi_agunan, [
  "SHM 1123",
  "BPKB Avanza",
]);
check("rekomendasi tidak dikenal -> REJECT", data.analisis_dan_rekomendasi.keputusan_komite.rekomendasi, "REJECT");
check("syarat_khusus null -> []", data.analisis_dan_rekomendasi.keputusan_komite.syarat_khusus, []);
check("detail null -> '-'", data.analisis_dan_rekomendasi.ringkasan_angsuran[0].detail, "-");
check(
  "issues mencatat rekomendasi tidak dikenal",
  issues.some((issue) => issue.includes("tidak dikenal")),
  true
);

const empty = normalizeSlikAnalysis("bukan json").data;
check("input non-objek tidak crash -> nama '-'", empty.data_pribadi.nama_lengkap, "-");
check("input non-objek -> fasilitas []", empty.fasilitas, []);

/* ---------- prompt builder ---------- */
const prompt = buildSlikUserPrompt([
  { fileName: "slik-a.pdf", pages: 3, text: "ISI-A", truncated: false },
  { fileName: "slik-b.pdf", pages: 1, text: "ISI-B", truncated: true },
]);
check("prompt menyebut jumlah dokumen", prompt.includes("2 dokumen"), true);
check("prompt memuat kedua berkas", prompt.includes("slik-a.pdf") && prompt.includes("slik-b.pdf"), true);
check("prompt menandai teks dipotong", prompt.includes("teks dipotong"), true);

console.log(`\n${failures === 0 ? "SEMUA UJI LULUS" : `${failures} UJI GAGAL`}`);
process.exitCode = failures === 0 ? 0 : 1;
