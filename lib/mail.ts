import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

export interface MailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Creates and returns a Nodemailer transporter configured for Gmail SMTP
 * or custom SMTP settings if provided in environment variables.
 */
function getMailTransporter() {
  const emailUser =
    process.env.EMAIL_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER;

  const rawPass =
    process.env.EMAIL_PASS ||
    process.env.GMAIL_PASS ||
    process.env.SMTP_PASS;

  if (!emailUser || !rawPass) {
    return null;
  }

  // Sanitize Google App Password by removing any spaces
  const emailPass = rawPass.replace(/\s+/g, "");

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;

  if (smtpHost) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  }

  // Default: Use Gmail service
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
}

/**
 * Generates an accessible, responsive HTML email template for OTP codes (Light Mode)
 */
function getOtpEmailHtml(otp: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campus Coders League Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);">
          <!-- Header / Brand -->
          <tr>
            <td style="padding: 36px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom: 14px;">
                <tr>
                  <td align="center">
                    <img src="cid:ccl-logo" alt="Campus Coders League" width="84" height="84" style="display: block; width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.06);" />
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; text-transform: uppercase;">
                Campus Coders League
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                Authentication &bull; Account Verification
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
                Hello,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #475569;">
                Please use the one-time verification code below to securely authenticate your Campus Coders League account:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 2px dashed #93c5fd; border-radius: 12px; padding: 24px 16px;">
                    <div style="font-family: 'SF Mono', Monaco, Consolas, 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; line-height: 1; padding-left: 10px;">
                      ${otp}
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500;">
                      One-time security code
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Notice and Expiration -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0 0 0; background-color: #fffbeb; border-radius: 8px; padding: 12px 16px; border-left: 4px solid #f59e0b;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #92400e; font-weight: 500;">
                      ⏱ This verification code is valid for <strong>10 minutes</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Advice -->
              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #94a3b8;">
                If you did not request this verification code, you can safely ignore this email. Never share your verification code with anyone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 500; color: #64748b;">
                Campus Coders League Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Campus Coders League. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Dispatches an OTP verification email to the user via SMTP.
 */
export async function sendOtpEmail(email: string, otp: string): Promise<MailResult> {
  const emailUser =
    process.env.EMAIL_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER;

  const emailFrom =
    process.env.EMAIL_FROM ||
    (emailUser ? `Campus Coders League <${emailUser}>` : "Campus Coders League <noreply@kiot.ac.in>");

  const transporter = getMailTransporter();

  // If no SMTP credentials configured, fail safely
  if (!transporter) {
    console.error(`[CAMPUS CODERS LEAGUE] SMTP credentials not configured. Cannot send email to ${email}.`);
    return {
      success: false,
      error: "Email delivery service is currently not configured. Please contact the administrator.",
    };
  }

  // Resolve logo file for inline email embedding (CID)
  const logoPath = path.join(process.cwd(), "public", "ccl_logo.jpeg");
  const attachments = fs.existsSync(logoPath)
    ? [
      {
        filename: "ccl_logo.jpeg",
        path: logoPath,
        cid: "ccl-logo",
      },
    ]
    : [];

  try {
    const info = await transporter.sendMail({
      from: emailFrom,
      to: email,
      subject: `Your Campus Coders League Verification Code: ${otp}`,
      text: `Your login code for Campus Coders League is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this code, please ignore this email.`,
      html: getOtpEmailHtml(otp),
      attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send email";
    console.error(`[EMAIL ERROR] Failed to send OTP email to ${email}:`, error);

    return {
      success: false,
      error: "Failed to dispatch verification email. Please try again.",
    };
  }
}
