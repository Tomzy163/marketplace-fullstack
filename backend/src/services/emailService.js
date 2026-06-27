const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { env } = require('../config/env');

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

function createTransport() {
  if (!env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
  });
}

async function sendEmail({ to, subject, text, html }) {
  const from = env.EMAIL_FROM;

  if (env.SENDGRID_API_KEY) {
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
