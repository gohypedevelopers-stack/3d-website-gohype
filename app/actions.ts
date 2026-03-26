"use server"

import nodemailer from "nodemailer"

type ContactPayload = {
  name?: string
  email?: string
  company?: string
  budget?: string
  message?: string
}

export async function sendEmail(payload: ContactPayload) {
  const name = String(payload?.name || "").trim()
  const email = String(payload?.email || "").trim()
  const company = String(payload?.company || "").trim()
  const budget = String(payload?.budget || "").trim()
  const message = String(payload?.message || "").trim()

  if (!name || !email) {
    return { error: "Name and email are required." }
  }

  const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER || ""
  const smtpPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || ""
  const recipients = (process.env.CONTACT_RECIPIENTS || smtpUser)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (!smtpUser || !smtpPass || recipients.length === 0) {
    return {
      error:
        "Contact email is not configured. Set GMAIL_USER, GMAIL_APP_PASSWORD, and CONTACT_RECIPIENTS in .env.local.",
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    const lines = [
      `Name: ${name}`,
      `Email: ${email}`,
      company ? `Company: ${company}` : "",
      budget ? `Budget: ${budget}` : "",
      message ? `Message: ${message}` : "",
    ].filter(Boolean)

    await transporter.sendMail({
      from: `"GoHype Inquiry" <${smtpUser}>`,
      to: recipients,
      replyTo: email,
      subject: `New GoHype inquiry from ${name}`,
      text: lines.join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;">
          <h2 style="margin:0 0 16px;">New enquiry from ${escapeHtml(name)}</h2>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          ${company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : ""}
          ${budget ? `<p><strong>Budget:</strong> ${escapeHtml(budget)}</p>` : ""}
          ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ""}
        </div>
      `,
    })

    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to send email.",
    }
  }
}

function escapeHtml(input: string) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
