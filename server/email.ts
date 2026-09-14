import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'RENIX';

function createTransport() {
  if (!SMTP_USER || !SMTP_APP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_APP_PASSWORD,
    },
  });
}

/** True when SMTP credentials are present, i.e. mail can actually be sent. */
export function isEmailConfigured(): boolean {
  return !!(SMTP_USER && SMTP_APP_PASSWORD);
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const transport = createTransport();

  if (!transport) {
    console.error('[Email] SMTP credentials not configured. Set SMTP_USER and SMTP_APP_PASSWORD environment variables.');
    return false;
  }

  const mailOptions = {
    from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 8px 0;">Reset your password</h2>
        <p style="font-size: 14px; color: #666; margin: 0 0 24px 0;">
          We received a request to reset the password for your account. Click the button below to set a new password.
        </p>
        <a href="${resetLink}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 6px;">
          Set new password
        </a>
        <p style="font-size: 13px; color: #999; margin: 24px 0 0 0;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `Reset your password\n\nWe received a request to reset the password for your account. Use this link to set a new password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  };

  try {
    await transport.sendMail(mailOptions);
    console.log(`[Email] Password reset email sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error(`[Email] Failed to send password reset email:`, error.message);
    return false;
  }
}
