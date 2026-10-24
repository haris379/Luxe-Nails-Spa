import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { business } from "../config/business.js";
import { verification } from "../config/verification.js";
import { formatTime } from "./schedule.js";
import { categoryLabel, categoryGroup } from "./categories.js";

let transporter = null;

export function emailConfigured() {
  return Boolean(env.smtp.host && env.smtp.from);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user
        ? { user: env.smtp.user, pass: env.smtp.pass }
        : undefined,
    });
  }
  return transporter;
}

// Single place where mail leaves the app. Tests replace `send`.
export const mailTransport = {
  send: (message) =>
    getTransporter().sendMail({ from: env.smtp.from, ...message }),
};

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

/**
 * Never throws. Returns { status: 'sent' | 'not_configured' | 'failed', error? }.
 * Only a short error code is kept: message text and recipients are never logged,
 * so one-time codes cannot leak into logs.
 */
export async function deliver(message) {
  if (!emailConfigured()) return { status: "not_configured" };
  try {
    await mailTransport.send(message);
    return { status: "sent" };
  } catch (err) {
    const code = String(err?.code || err?.name || "SEND_ERROR").slice(0, 40);
    console.error(`Email delivery failed (${code})`);
    return { status: "failed", error: code };
  }
}

// ---- Branded, responsive HTML shell (table layout + inline styles for email clients) ----
function layout({ preheader, heading, bodyHtml }) {
  const c = business.contact;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#fff5f7;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#ff6eb4;background-image:linear-gradient(90deg,#ffb3c6,#ff6eb4);padding:22px 24px;color:#ffffff;font-size:22px;font-weight:700;">${esc(business.name)}</td></tr>
<tr><td style="padding:24px;"><h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${esc(heading)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;background:#fff5f7;font-size:12px;color:#475569;">${esc(business.name)}<br>${esc(c.address)}<br>${esc(c.phone)} &middot; ${esc(c.email)}</td></tr>
</table></td></tr></table></body></html>`;
}

const money = (n, starting) =>
  `${starting ? "From " : ""}\u20B1${Number(n).toLocaleString("en-PH")}`;
const duration = (m) =>
  m >= 60
    ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`
    : `${m} min`;

/** Pure function: builds the booking email (request received, or confirmed by the salon). */
export function buildBookingEmail(appt) {
  const when = `${appt.date} at ${formatTime(appt.startMinutes)} (${business.timezone})`;
  const category = categoryLabel(appt.serviceCategory);
  const type =
    categoryGroup(appt.serviceCategory) === "spa"
      ? "spa treatment"
      : "nail appointment";
  const confirmed = appt.status === "confirmed";
  const pending = appt.status === "pending";
  const statusLine = pending
    ? "Pending. This is a request, not a confirmed appointment. The salon will confirm it shortly."
    : appt.status.charAt(0).toUpperCase() + appt.status.slice(1);
  const c = business.contact;
  const rows = [
    ["Reference", appt.reference],
    ["Status", statusLine],
    ["Category", category],
    ["Service", appt.serviceName],
    ["Date and time", when],
    ["Duration", duration(appt.durationMinutes)],
    ["Price", money(appt.servicePrice, appt.isStartingPrice)],
    ["Technician", appt.technicianName],
  ];
  const intro = confirmed
    ? `Good news! Your ${type} at ${business.name} is confirmed.`
    : `We received your ${type} request at ${business.name}. Your email address has been verified.`;
  const policy =
    "To cancel or reschedule, please contact us at least 24 hours ahead.";
  const text = [
    `Hi ${appt.customerName},`,
    "",
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    policy,
    `${business.name} | ${c.phone} | ${c.email} | ${c.address}`,
  ].join("\n");
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ffe9ef;color:#475569;width:38%;vertical-align:top;">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #ffe9ef;font-weight:600;">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`;
  const html = layout({
    preheader: intro,
    heading: confirmed
      ? "Your appointment is confirmed"
      : "Appointment request received",
    bodyHtml: `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${esc(appt.customerName)},<br>${esc(intro)}</p>${table}<p style="margin:16px 0 0;font-size:13px;color:#475569;">${esc(policy)}</p>`,
  });
  const subject = confirmed
    ? `Your appointment is confirmed (${appt.reference}) - ${business.name}`
    : pending
      ? `Appointment request received (${appt.reference}) - ${business.name}`
      : `Your ${business.name} appointment (${appt.reference})`;
  return { subject, text, html };
}

/** Pure function: builds the one-time-code email. */
export function buildOtpEmail(code) {
  const minutes = Math.round(verification.otpTtlMs / 60000);
  const subject = `${code} is your ${business.name} verification code`;
  const text = [
    `Your ${business.name} verification code is: ${code}`,
    "",
    `It expires in ${minutes} minutes and can be used once.`,
    `If you did not request this, you can safely ignore this email. Nobody can book with your address without this code.`,
    "",
    business.name,
  ].join("\n");
  const html = layout({
    preheader: `Your verification code is ${code}`,
    heading: "Verify your email address",
    bodyHtml: `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Enter this code on the booking page to confirm this email address belongs to you:</p>
<p style="margin:0 0 16px;text-align:center;"><span style="display:inline-block;padding:14px 22px;background:#fff5f7;border-radius:12px;font-size:32px;letter-spacing:8px;font-weight:700;color:#ec4899;">${esc(code)}</span></p>
<p style="margin:0;font-size:13px;color:#475569;">The code expires in ${minutes} minutes and can be used once. If you did not request it, ignore this email.</p>`,
  });
  return { subject, text, html };
}

export const sendOtpEmail = (to, code) =>
  deliver({ to, ...buildOtpEmail(code) });
export const sendBookingEmail = (appt) =>
  deliver({ to: appt.email, ...buildBookingEmail(appt) });

// ---- Contact-form notification (website visitor -> salon owner) ----

/** Splits MAIL_FROM ("Name <addr>" or "addr") into { name, address }. Returns null if no address is found. */
export function parseMailFrom(value) {
  const raw = String(value || "").trim();
  const m =
    raw.match(/^(.*?)<\s*([^<>\s]+@[^<>\s]+)\s*>$/) ||
    raw.match(/^()([^<>\s]+@[^<>\s]+)$/);
  if (!m) return null;
  return {
    name: m[1]
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .trim(),
    address: m[2],
  };
}

/** Makes visitor-supplied text safe to use as a display name: no control chars, quotes, brackets or "@". */
function safeDisplayName(value, max = 60) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>"@]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Pure function: builds the owner notification for a contact-form message.
 * - The From ADDRESS is always our own authenticated sender (never the visitor's address).
 * - The From DISPLAY NAME is "<Visitor> via <Brand>", so Gmail can show the visitor's name
 *   when the sending and receiving accounts are different.
 * - Reply-To is the visitor's (already validated) email, so Reply goes straight to them.
 */
export function buildContactEmail(msg) {
  const sender = parseMailFrom(env.smtp.from);
  const brand = (sender && sender.name) || `${business.name} Website`;
  const visitor = safeDisplayName(msg.name);
  const from = sender
    ? {
        name: visitor ? `${visitor} via ${brand}` : brand,
        address: sender.address,
      }
    : env.smtp.from;
  const text = `From: ${msg.name} <${msg.email}>\n\n${msg.message}`;
  const html = layout({
    preheader: `New website message from ${msg.name}`,
    heading: "New website message",
    bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;margin-bottom:16px;">
<tr><td style="padding:6px 0;color:#475569;width:30%;">Name</td><td style="padding:6px 0;font-weight:600;">${esc(msg.name)}</td></tr>
<tr><td style="padding:6px 0;color:#475569;">Email</td><td style="padding:6px 0;font-weight:600;">${esc(msg.email)}</td></tr>
<tr><td style="padding:6px 0;color:#475569;">Subject</td><td style="padding:6px 0;font-weight:600;">${esc(msg.subject)}</td></tr></table>
<p style="margin:0;font-size:15px;line-height:1.5;white-space:pre-wrap;">${esc(msg.message)}</p>
<p style="margin:16px 0 0;font-size:12px;color:#475569;">Press Reply to answer ${esc(msg.name)} directly.</p>`,
  });
  return {
    from,
    to: env.smtp.owner,
    replyTo: { name: visitor, address: msg.email },
    subject: msg.subject,
    text,
    html,
  };
}

export function sendContactEmail(msg) {
  if (!env.smtp.owner) return Promise.resolve({ status: "not_configured" });
  return deliver(buildContactEmail(msg));
}
