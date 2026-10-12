/**
 * Ekstraksi teks PDF untuk fitur analisa SLIK.
 *
 * Dipakai oleh API route (membaca PDF yang diunggah) dan oleh skrip verifikasi
 * (membaca ulang PDF laporan yang baru dibuat).
 *
 * CATATAN PENTING soal keandalan pustaka:
 * `pdf-parse-fork` (pdf.js 1.10.100) terbukti GAGAL ACAK pada berkas yang sama —
 * dalam pengujian di mesin ini sekitar 1 dari 8 pembacaan berakhir
 * "bad XRef entry" / "Command token too long" / "Illegal character", dan panggilan
 * pertama dalam satu proses paling sering gagal. Gejalanya menyerupai pembacaan
 * struktur berkas yang berlomba (race) di dalam pustaka, bukan berkas yang rusak:
 * berkas yang sama berhasil pada percobaan berikutnya, dan semua PDF yang diuji
 * terbaca normal di Chrome.
 *
 * Karena itu pembacaan TIDAK dipakai sekali jalan: teks diambil dengan beberapa
 * percobaan, setiap percobaan memakai salinan buffer berukuran persis (ArrayBuffer
 * di baliknya sepanjang isi berkas, tanpa ekor alokasi pool Node). Kegagalan baru
 * dilaporkan setelah semua percobaan habis, sehingga analis tidak melihat error
 * acak padahal berkasnya sehat.
 */
import pdfParse from "pdf-parse-fork";

export interface PdfTextResult {
  text: string;
  pages: number;
  /** Percobaan ke berapa yang berhasil (1 = langsung berhasil). */
  attempts: number;
}

const MAX_ATTEMPTS = 3;

/**
 * Salinan dengan ArrayBuffer berukuran tepat sepanjang isi berkas.
 * `Buffer.from(arrayBuffer)` berbagi memori dengan ArrayBuffer tersebut, sedangkan
 * `Buffer.from(typedArray)`/`Buffer.allocUnsafe` bisa memakai area pool Node yang
 * lebih besar dari berkasnya.
 */
function exactCopy(bytes: Uint8Array): Buffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return Buffer.from(copy);
}

export async function extractPdfText(input: ArrayBuffer | Uint8Array | Buffer): Promise<PdfTextResult> {
  const bytes =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const parsed = await pdfParse(exactCopy(bytes));
      return { text: parsed.text ?? "", pages: parsed.numpages || 0, attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Berkas PDF gagal dibaca setelah ${MAX_ATTEMPTS} percobaan (${
      lastError instanceof Error ? lastError.message : "penyebab tidak diketahui"
    }).`
  );
}
