/**
 * Klien OpenRouter untuk analisa dokumen SLIK OJK (IDEB).
 *
 * HANYA dipanggil dari server (API route) — modul ini membaca OPENROUTER_API_KEY
 * dan tidak boleh di-import oleh komponen client.
 */
import { normalizeSlikAnalysis, type SlikAnalysisResult, type SlikSourceInfo } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL?.trim() || "qwen/qwen3.7-flash";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL?.trim() || "deepseek/deepseek-v4.1-flash";
const REQUEST_TIMEOUT_MS = 180_000;

/** Batas teks gabungan yang dikirim ke model (menjaga biaya & konteks tetap wajar). */
export const MAX_PROMPT_DOC_CHARS = Number(process.env.SLIK_MAX_DOC_CHARS || 220_000);

export interface SlikSourceText {
  fileName: string;
  pages: number;
  text: string;
  truncated: boolean;
}

export class SlikAnalyzerError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "SlikAnalyzerError";
    this.status = status;
  }
}

const SCHEMA_TEMPLATE = `{
  "header": {
    "nomor_laporan": "string",
    "posisi_data": "string",
    "operator": "string"
  },
  "data_pribadi": {
    "nama_lengkap": "string",
    "nik": "string",
    "ttl_usia": "string (contoh: Jakarta, 12 Mei 1985 / 41 Tahun)",
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
      { "nama_bank": "string", "detail": "string", "nominal_per_bulan": "string" }
    ],
    "total_estimasi_angsuran_bulanan": "string",
    "inventarisasi_agunan": ["string"],
    "catatan_kritis_karakter": [
      { "judul": "string", "uraian": "string" }
    ],
    "keputusan_komite": {
      "rekomendasi": "REJECT | APPROVE | CONSIDER",
      "risk_rating": "string",
      "saran_tindakan": ["string"],
      "syarat_khusus": ["string"]
    }
  }
}`;

export const SLIK_SYSTEM_PROMPT = `Anda adalah analis kredit senior BPR (Bank Perekonomian Rakyat) di Indonesia yang ahli membaca laporan SLIK OJK (IDEB) dan menilai risiko kredit.

TUGAS: ekstrak seluruh data penting dari teks laporan SLIK OJK yang diberikan, hitung estimasi angsuran, inventarisasi agunan, tulis catatan kritis karakter & kapasitas, lalu berikan rekomendasi komite kredit.

ATURAN WAJIB:
1. Balas HANYA dengan satu objek JSON valid. Tanpa markdown, tanpa backtick, tanpa kalimat pembuka/penutup.
2. Ikuti skema berikut PERSIS (nama key & struktur): ${SCHEMA_TEMPLATE}
3. Semua nominal uang adalah ANGKA murni tanpa titik/koma/Rp (contoh: 1500000). Jangan ubah menjadi string.
4. Jika sebuah data tidak ada pada laporan, isi string kosong "" untuk teks, 0 untuk angka, atau [] untuk array. JANGAN mengarang data.
5. Fasilitas: ambil SEMUA fasilitas kredit dari SEMUA bank pelapor. kolektibilitas diisi kode SLIK apa adanya (1, 2, 3, 4, 5 atau kode huruf yang tertulis). status_kondisi diisi "Aktif" / "Lunas" / "Dihapus Buku" sesuai laporan.
6. est_angsuran_bulan adalah estimasi angsuran bulanan fasilitas tersebut (angka). Bila tidak tertulis, estimasikan dari plafon, suku bunga, dan sisa tenor yang terlihat.
7. total_estimasi_angsuran_bulanan diisi string seperti "Rp 12.500.000/bulan" — jumlahkan seluruh angsuran aktif di luar fasilitas yang sudah lunas.
8. catatan_kritis_karakter: soroti tunggakan, kolektibilitas terburuk, fasilitas hapus buku, DPK/macet, dan riwayat buruk lain. Minimal 3 poin bila datanya tersedia.
9. keputusan_komite.rekomendasi HARUS salah satu dari: REJECT, APPROVE, CONSIDER. Gunakan REJECT bila ada tunggakan macet/hapus buku, CONSIDER bila riwayat rapi namun kapasitas angsuran perlu mitigasi, APPROVE bila seluruh fasilitas lancar dan kapasitas memadai.
10. risk_rating diisi salah satu: LOW RISK, MEDIUM RISK, HIGH RISK, VERY HIGH RISK.
11. Seluruh uraian ditulis dalam Bahasa Indonesia profesional dan ringkas.`;

export function buildSlikUserPrompt(sources: SlikSourceText[]): string {
  const parts: string[] = [];
  const totalChars = sources.reduce((sum, s) => sum + s.text.length, 0);

  parts.push(
    `Berikut ${sources.length} dokumen laporan SLIK OJK (IDEB) debitur yang sama. ` +
      `Total ${totalChars.toLocaleString("id-ID")} karakter. Ekstrak menjadi satu objek JSON sesuai skema.`
  );

  sources.forEach((source, index) => {
    parts.push(
      `\n===== DOKUMEN ${index + 1}: ${source.fileName} (${source.pages} halaman${
        source.truncated ? ", teks dipotong" : ""
      }) =====\n${source.text}`
    );
  });

  return parts.join("\n");
}

/**
 * Mengambil blok JSON pertama dari respons model. Model kadang tetap membungkus
 * output dengan ```json ... ``` atau menambah kalimat pembuka, jadi fence dibuang
 * lalu diambil dari kurung kurawal pertama sampai terakhir.
 */
export function extractJsonPayload(content: string): string {
  let text = (content || "").trim();

  // Buang blok fenced markdown.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) text = fenced[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

interface OpenRouterChoiceMessage {
  content?: string | null;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: OpenRouterChoiceMessage }>;
  error?: { message?: string; code?: number | string };
}

async function callOpenRouter(model: string, userPrompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Header identifikasi opsional yang dipakai OpenRouter untuk atribusi.
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "BPR Adiartha - SLIK OJK Analyzer",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SLIK_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as OpenRouterResponse | null;

    if (!response.ok) {
      const detail = payload?.error?.message || `HTTP ${response.status}`;
      throw new SlikAnalyzerError(`OpenRouter menolak permintaan (${model}): ${detail}`, 502);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new SlikAnalyzerError(`Model ${model} tidak mengembalikan konten analisa.`, 502);
    }

    return content;
  } catch (error) {
    if (error instanceof SlikAnalyzerError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SlikAnalyzerError(
        `Permintaan ke model ${model} melebihi batas waktu ${REQUEST_TIMEOUT_MS / 1000} detik.`,
        504
      );
    }
    throw new SlikAnalyzerError(
      `Gagal menghubungi OpenRouter: ${error instanceof Error ? error.message : String(error)}`,
      502
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Menjalankan analisa: coba model utama, dan bila gagal otomatis pakai model fallback.
 * Hasil JSON dinormalisasi agar selalu aman dirender oleh generator laporan.
 */
export async function analyzeSlikDocuments(sources: SlikSourceText[]): Promise<SlikAnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new SlikAnalyzerError(
      "OPENROUTER_API_KEY belum dikonfigurasi. Tambahkan variabel tersebut pada file .env lalu restart server.",
      500
    );
  }

  if (sources.length === 0) {
    throw new SlikAnalyzerError("Tidak ada teks dokumen yang dapat dianalisa.", 400);
  }

  const startedAt = Date.now();
  const userPrompt = buildSlikUserPrompt(sources);
  const warnings: string[] = [];

  const models = PRIMARY_MODEL === FALLBACK_MODEL ? [PRIMARY_MODEL] : [PRIMARY_MODEL, FALLBACK_MODEL];
  let rawContent = "";
  let usedModel = models[0];
  let lastError: unknown = null;

  for (const model of models) {
    try {
      rawContent = await callOpenRouter(model, userPrompt, apiKey);
      usedModel = model;
      if (model !== models[0]) {
        warnings.push(`Model utama (${models[0]}) gagal, analisa dijalankan ulang memakai ${model}.`);
      }
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Model ${model} gagal: ${message}`);
    }
  }

  if (!rawContent) {
    throw lastError instanceof SlikAnalyzerError
      ? lastError
      : new SlikAnalyzerError("Seluruh model OpenRouter gagal memproses dokumen SLIK.", 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonPayload(rawContent));
  } catch {
    throw new SlikAnalyzerError(
      "Respons model bukan JSON yang valid sehingga tidak dapat dijadikan laporan. Silakan ulangi analisa.",
      502
    );
  }

  const { data, issues } = normalizeSlikAnalysis(parsed);
  warnings.push(...issues);

  const sourceInfo: SlikSourceInfo[] = sources.map((s) => ({
    fileName: s.fileName,
    pages: s.pages,
    chars: s.text.length,
    truncated: s.truncated,
  }));

  return {
    data,
    model: usedModel,
    warnings,
    sources: sourceInfo,
    elapsedMs: Date.now() - startedAt,
  };
}
