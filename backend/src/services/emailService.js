const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function createTransport() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
}

async function sendEmail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || 'no-reply@example.com';

  if (process.env.SENDGRID_API_KEY) {
    await sgMail.send({ to, from, subject, text, html });
    return;
  }

  const transport = createTransport();
  if (!transport) {
    console.warn(`Email skipped; configure SENDGRID_API_KEY or SMTP_HOST. Subject: ${subject}`);
    return;
  }

  await transport.sendMail({ to, from, subject, text, html });
}

module.exports = {
  sendEmail,
};
