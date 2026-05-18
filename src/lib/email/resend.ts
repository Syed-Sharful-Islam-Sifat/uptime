import { Resend } from "resend";
import { env } from "../../config/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const sendVerificationEmail = async (
  toEmail: string,
  token: string,
): Promise<void> => {
  const verifyUrl = `${env.APP_URL}/api/v1/auth/verify-email?token=${token}`;

  // In development without an API key, print the link to the console so you can
  // verify accounts locally without setting up Resend.
  if (!resend) {
    console.log(`\n[DEV] Verification link for ${toEmail}:\n${verifyUrl}\n`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: toEmail,
    subject: "Verify your email — Uptime Monitor",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin-bottom:8px">Verify your email address</h2>
        <p style="color:#555;margin-bottom:24px">
          Thanks for signing up. Click the button below to confirm your email.
          This link expires in <strong>24 hours</strong>.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#000;color:#fff;padding:12px 24px;
                  border-radius:6px;text-decoration:none;font-weight:600">
          Verify Email
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px">
          Or copy this URL into your browser:<br>
          <a href="${verifyUrl}" style="color:#555;word-break:break-all">${verifyUrl}</a>
        </p>
        <p style="color:#aaa;font-size:12px;margin-top:32px">
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
};
