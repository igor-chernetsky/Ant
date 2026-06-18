import nodemailer from 'nodemailer';
import { createEmailVerificationToken } from '@/lib/email-verification-token';

function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

function buildVerificationEmailHtml(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4fa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f4fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;">Ant Construction</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Verify your email</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#64748b;">
                Thanks for signing up. Confirm your email address to activate your account — one click and you are done.
              </p>
              <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">
                Verify email address
              </a>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                This link expires in 24 hours. If you did not create an account, you can ignore this message.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all;">
                Or copy this link:<br>${verifyUrl}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAppVerificationEmail(params: {
  userId: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = createEmailVerificationToken(params.userId, params.email);
  if (!token) {
    return {
      ok: false,
      message:
        'Email verification is not configured (EMAIL_VERIFICATION_SECRET or SMTP).',
    };
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Ant Construction';
  const port = Number(process.env.SMTP_PORT ?? '587');

  if (!host || !user || !pass || !from) {
    return {
      ok: false,
      message: 'SMTP is not configured on the server.',
    };
  }

  const verifyUrl = `${getAppBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    requireTLS: port === 587,
  });

  try {
    await transport.sendMail({
      from: `"${fromName}" <${from}>`,
      to: params.email,
      subject: 'Verify your Ant Construction account',
      html: buildVerificationEmailHtml(verifyUrl),
      text: `Verify your Ant Construction account:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    });
    return { ok: true };
  } catch (error: unknown) {
    console.error('[send-verification-email]', error);
    return {
      ok: false,
      message: 'Failed to send verification email via SMTP.',
    };
  }
}
