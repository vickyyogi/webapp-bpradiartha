/**
 * Tahap 8 (P1.5) — utilitas ekspor laporan yang aman.
 * - Netralkan CSV Injection (sel yang diawali = + - @ TAB CR).
 * - Kutip/escape nilai agar struktur CSV tidak rusak.
 * - Streaming baris agar ekspor besar tidak menahan seluruh data di memori.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Mengubah satu nilai menjadi sel CSV yang aman. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  // CSV Injection: Excel/LibreOffice menjalankan sel yang diawali karakter formula.
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Menggabungkan satu baris CSV (tanpa newline). */
export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

/** Header + isi CSV sebagai ReadableStream; baris diambil dari async iterable. */
export function createCsvStream(
  header: string[],
  rows: AsyncIterable<unknown[]>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // BOM agar Excel mendeteksi UTF-8 dengan benar.
        controller.enqueue(encoder.encode("\uFEFF"));
        controller.enqueue(encoder.encode(`${csvRow(header)}\r\n`));
        for await (const row of rows) {
          controller.enqueue(encoder.encode(`${csvRow(row)}\r\n`));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/** Ukuran batch kueri ekspor. */
export const EXPORT_BATCH_SIZE = 500;
