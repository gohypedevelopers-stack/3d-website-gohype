"use server";

import nodemailer from 'nodemailer';

const DEFAULT_CONTACT_RECIPIENT = 'ravindranathjha76@gmail.com';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = (process.env.SMTP_SECURE || 'true') === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const CONTACT_RECIPIENTS = [DEFAULT_CONTACT_RECIPIENT, ...(process.env.CONTACT_RECIPIENTS || '').split(',')]
  .map((s) => s.trim())
  .filter(Boolean);

// Define the shape of our form data
interface FormData {
  name: string;
  email: string;
  company: string;
  message: string;
}

export async function sendEmail(formData: FormData) {
  const { name, email, company, message } = formData;

  // Basic validation
  if (!name || !email) {
    return { error: 'Name and Email are required fields.' };
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || CONTACT_RECIPIENTS.length === 0) {
    console.error('Email service not configured: missing SMTP env vars');
    return { error: 'Email service is not configured.' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_FROM_EMAIL,
      to: CONTACT_RECIPIENTS,
      replyTo: email,
      subject: `New Quote Request from ${name}`,
      text: buildText({ name, email, company, message }),
      html: renderEmail({ name, email, company, message }),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Email send error:", error);
    return { error: error?.message || 'Email failed to send.' };
  }
}

function renderEmail({ name, email, company, message }: FormData) {
  // Reuse the React email template to build HTML
  // (React rendering to string is supported in Resend template; here we keep it simple)
  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;">
      <h2 style="margin:0 0 16px;">New enquiry from ${escapeHtml(name)}</h2>
      <table style="border-collapse:collapse;">
        ${row('Name', name)}
        ${row('Email', email)}
        ${row('Company', company)}
        ${row('Message', message)}
        ${row('Source', 'Hero form')}
      </table>
    </div>
  `;
}

function buildText({ name, email, company, message }: FormData) {
  return [
    `New enquiry from ${name}`,
    `Email: ${email}`,
    `Company: ${company || 'n/a'}`,
    `Message: ${message || 'n/a'}`,
    `Source: Hero form`,
  ].join('\n');
}

function row(label: string, value: string) {
  return `<tr><td style="padding:4px 0;color:#0f172a;"><strong>${label}:</strong></td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(
    value || '—',
  )}</td></tr>`;
}

function escapeHtml(input: string) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
