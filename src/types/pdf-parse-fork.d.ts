/**
 * Ambient types untuk `pdf-parse-fork` (paket CJS tanpa deklarasi TypeScript).
 */
declare module "pdf-parse-fork" {
  export interface PdfParseResult {
    /** Seluruh teks yang berhasil diekstrak dari PDF. */
    text: string;
    /** Jumlah halaman. */
    numpages: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  }

  export interface PdfParseOptions {
    /** Halaman maksimum yang diproses (opsional). */
    max?: number;
    /** Versi PDF.js yang dipakai. */
    version?: string;
  }

  function pdfParse(
    dataBuffer: Buffer | Uint8Array | ArrayBuffer,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
