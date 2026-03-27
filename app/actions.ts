"use server";

import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const CONTACT_RECIPIENTS = (process.env.CONTACT_RECIPIENTS || GMAIL_USER).split(',').map((s) => s.trim()).filter(Boolean);

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

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || CONTACT_RECIPIENTS.length === 0) {
    console.error('Email service not configured: missing env vars');
    return { error: 'Email service is not configured.' };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"GoHype Inquiry" <${GMAIL_USER}>`,
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
