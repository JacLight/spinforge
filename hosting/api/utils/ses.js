/**
 * SpinForge - Thin wrapper over AWS SES SendEmail.
 *
 * All outgoing mail goes through this module. Notifications themselves
 * never talk to the SDK directly — they enqueue jobs and the EmailWorker
 * calls sendEmail() from this file. That keeps the SDK import in one
 * place and makes it easy to swap transports (SMTP, a local mailhog for
 * tests, etc.) by changing this file alone.
 *
 * Env:
 *   AWS_REGION               default us-east-1
 *   AWS_ACCESS_KEY_ID        SES-scoped access key
 *   AWS_SECRET_ACCESS_KEY    SES-scoped secret
 *   MAIL_FROM                default sender (e.g. "SpinForge <noreply@spinforge.dev>")
 */

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

let _client = null;
function client() {
  if (_client) return _client;
  _client = new SESClient({
    region: process.env.AWS_REGION || 'us-east-1',
    // If creds are missing the SDK will try the default chain (IAM role,
    // shared config, etc.). We pass explicit creds only when both are set.
    credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      ? {
          accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
  return _client;
}

/**
 * Send one email. Returns the SES MessageId on success, throws on error.
 * Keep the signature small — templating/rendering happens upstream.
 */
async function sendEmail({ to, subject, html, text, from, replyTo }) {
  if (!to) throw new Error('sendEmail: "to" is required');
  if (!subject) throw new Error('sendEmail: "subject" is required');
  if (!html && !text) throw new Error('sendEmail: "html" or "text" is required');

  const Source = from || process.env.MAIL_FROM || 'noreply@spinforge.dev';
  const ToAddresses = Array.isArray(to) ? to : [to];

  const command = new SendEmailCommand({
    Source,
    Destination: { ToAddresses },
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : {}),
        ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
      },
    },
  });

  const res = await client().send(command);
  return res.MessageId;
}

/**
 * Is SES configured well enough to actually send? Used by the admin UI
 * to show a warning when mail won't go out.
 */
function mailerStatus() {
  return {
    hasRegion:      !!process.env.AWS_REGION,
    hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    from:           process.env.MAIL_FROM || 'noreply@spinforge.dev',
    region:         process.env.AWS_REGION || 'us-east-1',
  };
}

module.exports = { sendEmail, mailerStatus };
