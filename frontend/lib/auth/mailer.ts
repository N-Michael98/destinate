import nodemailer from "nodemailer";

// Configure via environment variables:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// For Gmail: use App Password (not your regular password)
// For Railway: set these as environment variables

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    },
  });
}

export async function sendVerificationEmail(
  toEmail: string,
  username: string,
  token: string,
  baseUrl: string
): Promise<{ ok: boolean; error?: string }> {
  // If no SMTP configured → dev mode, just log the link
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const link = `${baseUrl}/verify-email?token=${token}`;
    console.log(`\n[DEV EMAIL] Verify link for ${username}:\n${link}\n`);
    return { ok: true }; // In dev: pretend email was sent, check console
  }

  try {
    const link = `${baseUrl}/verify-email?token=${token}`;
    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@trading.local";

    await getTransport().sendMail({
      from: `"Destinate" <${from}>`,
      to: toEmail,
      subject: "E-Mail bestätigen — Destinate",
      html: `
        <div style="font-family:monospace;background:#0a0f1a;color:#e2e8f0;padding:40px;border-radius:12px;max-width:480px;">
          <div style="font-size:24px;font-weight:700;margin-bottom:16px;">📈 Destinate</div>
          <p style="color:#94a3b8;">Hallo <strong style="color:#a5b4fc;">${username}</strong>,</p>
          <p style="color:#94a3b8;">bitte bestätige deine E-Mail-Adresse um fortzufahren:</p>
          <a href="${link}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">
            ✓ E-Mail bestätigen
          </a>
          <p style="color:#475569;font-size:11px;">
            Nach der Bestätigung prüft der Admin deinen Account und gibt ihn frei.<br/>
            Dieser Link ist 24 Stunden gültig.
          </p>
          <p style="color:#334155;font-size:11px;">Falls du dich nicht registriert hast, ignoriere diese E-Mail.</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "E-Mail konnte nicht gesendet werden" };
  }
}
