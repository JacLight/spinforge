/**
 * Seed content for the v1 notification templates. On first boot these
 * are written to Redis and never touched again — operator edits via the
 * admin UI take over from there. Adding a new event? Add it here AND
 * the list in NotificationService.EVENTS.
 *
 * Convention: keep the HTML minimal. No CSS imports, no external assets,
 * no tracking pixels. Clients render email wildly differently and a
 * plain, wide-compatible layout wins over a pretty one that breaks in
 * Outlook.
 *
 * Available context variables are documented per-template under the
 * `variables` field so the admin UI can show them as hints.
 */

module.exports = [
  {
    event: 'site_created',
    subject: 'Your site {{domain}} is live on SpinForge',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;">Your site is live</h2>
  <p>Hi {{name}},</p>
  <p><strong>{{domain}}</strong> has been created on SpinForge and is serving traffic.</p>
  <p style="background:#f4f4f5;padding:12px 16px;border-radius:6px;margin:16px 0;">
    <strong>Domain:</strong> {{domain}}<br/>
    <strong>Type:</strong> {{type}}<br/>
    <strong>SSL:</strong> {{sslStatus}}
  </p>
  <p>If you pointed DNS at us, TLS will auto-issue on the first HTTPS request.</p>
  <p style="color:#666;margin-top:32px;font-size:13px;">
    You're receiving this because you deploy sites on SpinForge. Questions?
    Reply to this email.
  </p>
</div>`,
    variables: ['name', 'domain', 'type', 'sslStatus'],
  },

  {
    event: 'custom_domain_added',
    subject: 'Set DNS for {{domain}} to finish setup',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;">One step to go: point DNS</h2>
  <p>Hi {{name}},</p>
  <p>You added <strong>{{domain}}</strong> to SpinForge. To finish setup, create this DNS record at your domain registrar:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr style="background:#f4f4f5;">
      <th align="left" style="padding:8px;border:1px solid #e4e4e7;">Type</th>
      <th align="left" style="padding:8px;border:1px solid #e4e4e7;">Name</th>
      <th align="left" style="padding:8px;border:1px solid #e4e4e7;">Value</th>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #e4e4e7;">A</td>
      <td style="padding:8px;border:1px solid #e4e4e7;">{{domain}}</td>
      <td style="padding:8px;border:1px solid #e4e4e7;">{{edgeIp}}</td>
    </tr>
  </table>
  <p>Once DNS propagates (usually under 10 minutes), your site will start serving and we'll auto-issue a TLS certificate from Let's Encrypt.</p>
  <p style="color:#666;margin-top:32px;font-size:13px;">You won't get another email until the domain is live — or if setup fails.</p>
</div>`,
    variables: ['name', 'domain', 'edgeIp'],
  },

  {
    event: 'cert_renewal_failed',
    subject: 'Action needed: SSL renewal failed for {{domain}}',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;color:#b91c1c;">SSL renewal failed</h2>
  <p>Hi {{name}},</p>
  <p>SpinForge tried to renew the Let's Encrypt certificate for <strong>{{domain}}</strong> and it failed:</p>
  <pre style="background:#f4f4f5;padding:12px 16px;border-radius:6px;white-space:pre-wrap;word-break:break-word;font-size:13px;">{{reason}}</pre>
  <p><strong>Current cert expires:</strong> {{expiresAt}}</p>
  <p>Most common cause: DNS for {{domain}} no longer points to SpinForge's edge. If that's intentional, you can delete the site. Otherwise, verify your A/AAAA records and we'll retry automatically every hour.</p>
  <p style="color:#666;margin-top:32px;font-size:13px;">Sites keep serving on the existing cert until it expires.</p>
</div>`,
    variables: ['name', 'domain', 'reason', 'expiresAt'],
  },

  {
    event: 'container_crashed',
    subject: '{{domain}} keeps crashing',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;color:#b91c1c;">Container failing to stay up</h2>
  <p>Hi {{name}},</p>
  <p>The container for <strong>{{domain}}</strong> has crashed and restarted repeatedly ({{restartCount}} times in the last {{windowMinutes}} minutes). Nomad is still retrying, but something in the workload is exiting non-zero.</p>
  <p>Common causes: bad image tag, missing env var, failing startup script, listening on the wrong port.</p>
  <p><strong>Recent logs:</strong></p>
  <pre style="background:#f4f4f5;padding:12px 16px;border-radius:6px;white-space:pre-wrap;word-break:break-word;font-size:12px;max-height:300px;overflow:auto;">{{logs}}</pre>
  <p>You can pull more via the SpinForge API:</p>
  <pre style="background:#f4f4f5;padding:8px 12px;border-radius:6px;font-size:13px;">GET /_api/customer/sites/{{domain}}/logs</pre>
</div>`,
    variables: ['name', 'domain', 'restartCount', 'windowMinutes', 'logs'],
  },

  // ─── Account access ─────────────────────────────────────────────────
  // These three carry or confirm a credential. Keep {{link}} as a bare
  // anchor — some clients strip button markup, and a customer who can't
  // click the link can't get into their account.

  {
    event: 'magic_link_signin',
    subject: 'Your SpinForge sign-in link',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;">Sign in to SpinForge</h2>
  <p>Hi {{name}},</p>
  <p>Click below to sign in. No password needed.</p>
  <p style="margin:24px 0;">
    <a href="{{link}}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Sign in to SpinForge</a>
  </p>
  <p style="font-size:13px;color:#666;">Or paste this into your browser:<br/>
    <a href="{{link}}" style="word-break:break-all;">{{link}}</a>
  </p>
  <p>This link expires in {{expiresMinutes}} minutes and can only be used once.</p>
  <p style="color:#666;margin-top:32px;font-size:13px;">
    Didn't ask for this? Ignore this email — nothing changes until the link is used.
  </p>
</div>`,
    variables: ['name', 'email', 'link', 'expiresMinutes'],
  },

  {
    event: 'password_reset',
    subject: 'Reset your SpinForge password',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;">Reset your password</h2>
  <p>Hi {{name}},</p>
  <p>Someone asked to reset the password for <strong>{{email}}</strong>. Click below to choose a new one.</p>
  <p style="margin:24px 0;">
    <a href="{{link}}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Choose a new password</a>
  </p>
  <p style="font-size:13px;color:#666;">Or paste this into your browser:<br/>
    <a href="{{link}}" style="word-break:break-all;">{{link}}</a>
  </p>
  <p>This link expires in {{expiresMinutes}} minutes and can only be used once. Setting a new password signs out every other device.</p>
  <p style="color:#666;margin-top:32px;font-size:13px;">
    Didn't ask for this? Ignore this email — your current password still works.
  </p>
</div>`,
    variables: ['name', 'email', 'link', 'expiresMinutes'],
  },

  {
    event: 'password_changed',
    subject: 'Your SpinForge password was changed',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;">Password changed</h2>
  <p>Hi {{name}},</p>
  <p>The password for <strong>{{email}}</strong> was changed on {{changedAt}}. Every other signed-in session was ended.</p>
  <p>If that was you, nothing more to do.</p>
  <p><strong>If it wasn't</strong>, reset your password immediately at
    <a href="{{resetUrl}}">{{resetUrl}}</a> and reply to this email so we can look into it.
  </p>
  <p style="color:#666;margin-top:32px;font-size:13px;">
    API tokens you created are not affected by a password change — revoke them from
    Settings if you think they've been exposed.
  </p>
</div>`,
    variables: ['name', 'email', 'changedAt', 'resetUrl'],
  },
];
