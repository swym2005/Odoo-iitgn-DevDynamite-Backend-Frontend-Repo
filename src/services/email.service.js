import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null; // Fallback to console logging
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  const from = process.env.EMAIL_FROM || 'OrbitOne <no-reply@local>'; 
  const t = getTransporter();
  if (!t) {
    console.log('[EMAIL:DEV]', { from, to, subject, html });
    return { mocked: true };
  }
  return t.sendMail({ from, to, subject, html });
};
