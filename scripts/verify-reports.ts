/**
 * Tahap 8 (P1.5) — verifikasi ekspor laporan yang aman.
 * Cek netralisasi CSV Injection, escaping, streaming, dan masking PII.
 */
import { csvCell, csvRow, createCsvStream } from "../src/lib/report-export";
import { maskAccountNumber, maskEmail, maskNIK, maskPhone } from "../src/lib/privacy";

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}`);
  if (!ok) failed++;
}

(async () => {
  for (const dangerous of ["=1+1", "+CMD", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) {
    const out = csvCell(dangerous);
    check(`formula dinetralkan: ${JSON.stringify(dangerous)}`, out.startsWith(`"\'`) || out.startsWith(`"\'\t`) || out.startsWith(`"\'\r`));
  }

  check("sel biasa tetap utuh", csvCell("Budi Santoso") === '"Budi Santoso"');
  check("kutip di-escape", csvCell('Nama "Budi"') === '"Nama ""Budi"""');
  check("null jadi kosong", csvCell(null) === "" && csvCell(undefined) === "");
  check("newline di dalam sel tidak memecah baris", csvCell("a\nb") === '"a\nb"');
  check("csvRow memakai koma", csvRow(["A", 1]) === '"A","1"');

  const stream = createCsvStream(["A", "B"], (async function* () {
    yield ["=x", 2];
  })());
  const reader = stream.getReader();
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    text += new TextDecoder().decode(value);
  }
  check("stream punya header + baris", text.includes('"A","B"') && text.includes(`"\'=x","2"`));
  check("stream memakai CRLF", text.includes("\r\n"));

  check("mask NIK", maskNIK("3171012345678901") === "3171**********01");
  check("mask telepon", maskPhone("081234567890") === "0812****7890");
  check("mask email", maskEmail("budi.santoso@bpr.com").endsWith("@bpr.com"));
  check("mask rekening", maskAccountNumber("1234567890") === "123****890");

  console.log(`\n${failed === 0 ? "LULUS" : `${failed} GAGAL`}`);
  process.exit(failed === 0 ? 0 : 1);
})();
