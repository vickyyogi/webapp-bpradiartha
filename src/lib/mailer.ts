/**
 * Pengiriman email (Tahap 1B-2).
 *
 * Dua transport:
 * - "smtp"  : dipakai bila SMTP_HOST (+ MAIL_FROM) diisi. Ini jalur produksi.
 * - "file"  : hanya untuk pengujian/lingkungan non-produksi. Isi email ditulis
 *             sebagai berkas JSON di MAIL_OUTBOX_DIR, sehingga alur reset dapat
 *             diuji menyeluruh tanpa kredensial SMTP nyata. Ditolak tegas pada
 *             NODE_ENV=production.
 *
 * Tidak ada nilai rahasia yang pernah dicetak oleh modul ini. Isi email memang
 * memuat tautan reset — karena itu transport "file" menulis ke direktori lokal
 * yang harus dijaga seperti berkas sensitif.
 */
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailResult {
  sent: boolean;
  transport: "smtp" | "file" | "none";
  error?: string;
  previewPath?: string;
}

export type MailTransportName = "smtp" | "file" | "none";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

/** Menentukan transport yang berlaku berdasarkan lingkungan. */
export function mailTransportName(): MailTransportName {
  const explicit = process.env.MAIL_TRANSPORT?.trim().toLowerCase();
  const produksi = process.env.NODE_ENV === "production";

  if (explicit === "file") {
    // Keselamatan: transport berkas tidak pernah aktif di produksi.
    return produksi ? "none" : "file";
  }

  if (explicit === "smtp") {
    return smtpConfigured() ? "smtp" : "none";
  }

  return smtpConfigured() ? "smtp" : "none";
}

function outboxDir(): string {
  return process.env.MAIL_OUTBOX_DIR?.trim() || path.join(tmpdir(), "bpr-mail-outbox");
}

/**
 * Mengirim email. Tidak pernah melempar: kegagalan dikembalikan sebagai hasil
 * supaya pemanggil tetap dapat memberi jawaban generik kepada pengguna (dan
 * mencatat masalahnya untuk operator).
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const transport = mailTransportName();

  if (transport === "none") {
    return {
      sent: false,
      transport,
      error:
        "Transport email belum dikonfigurasi. Isi SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, dan MAIL_FROM di .env " +
        "(atau MAIL_TRANSPORT=file untuk pengujian di lingkungan non-produksi).",
    };
  }

  if (transport === "file") {
    try {
      const dir = outboxDir();
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `mail-${Date.now()}-${randomBytes(3).toString("hex")}.json`);
      await fs.writeFile(
        file,
        JSON.stringify({ ...message, createdAt: new Date().toISOString(), transport }, null, 2),
        "utf8"
      );
      return { sent: true, transport, previewPath: file };
    } catch (error) {
      return { sent: false, transport, error: error instanceof Error ? error.message : "Gagal menulis kotak surat uji." };
    }
  }

  try {
    const from = process.env.MAIL_FROM?.trim();
    if (!from) {
      return { sent: false, transport, error: "MAIL_FROM belum diisi." };
    }

    const nodemailer = (await import("nodemailer")).default;
    const port = Number(process.env.SMTP_PORT?.trim() || 587);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim(),
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    await transporter.sendMail({ from, to: message.to, subject: message.subject, text: message.text });
    return { sent: true, transport };
  } catch (error) {
    return { sent: false, transport, error: error instanceof Error ? error.message : "Pengiriman SMTP gagal." };
  }
}
