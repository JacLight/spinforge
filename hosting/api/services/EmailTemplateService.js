/**
 * SpinForge - Email template storage + rendering.
 *
 * Templates live in Redis under `email_template:<event>` so operators can
 * edit them from the admin UI without redeploying. Each template has:
 *
 *   event      stable id — matches the NotificationService event type
 *   subject    plain-text template
 *   html       HTML template
 *   text       optional plain-text alternative
 *   variables  declared context vars (for UI validation + docs)
 *   enabled    if false, the event silently skips sending
 *
 * Render is a minimal {{var}} + {{var.path}} substitution — deliberately
 * not Handlebars, to avoid the dep and the surface area that partials /
 * helpers would give. If someone needs real logic in an email, extend
 * NotificationService to precompute the string and pass it as a flat var.
 */

const DEFAULT_TEMPLATES = require('./email-templates.default');

const KEY = (event) => `email_template:${event}`;
const LIST_KEY = 'email_templates:all';

class EmailTemplateService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * On first boot, seed every default template that doesn't already
   * exist in Redis. Existing records are untouched so operator edits
   * survive a redeploy.
   */
  async seedDefaults() {
    let created = 0;
    for (const tmpl of DEFAULT_TEMPLATES) {
      const exists = await this.redis.exists(KEY(tmpl.event));
      if (!exists) {
        const now = new Date().toISOString();
        await this.redis.set(KEY(tmpl.event), JSON.stringify({
          ...tmpl,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        }));
        await this.redis.sAdd(LIST_KEY, tmpl.event);
        created++;
      }
    }
    return { created, total: DEFAULT_TEMPLATES.length };
  }

  async list() {
    const events = await this.redis.sMembers(LIST_KEY);
    const out = [];
    for (const ev of events) {
      const raw = await this.redis.get(KEY(ev));
      if (raw) out.push(JSON.parse(raw));
    }
    return out.sort((a, b) => a.event.localeCompare(b.event));
  }

  async get(event) {
    const raw = await this.redis.get(KEY(event));
    return raw ? JSON.parse(raw) : null;
  }

  async update(event, patch) {
    const existing = await this.get(event);
    if (!existing) throw new Error(`Template "${event}" not found`);
    const merged = {
      ...existing,
      ...patch,
      event: existing.event,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(KEY(event), JSON.stringify(merged));
    return merged;
  }

  /**
   * Render subject/html/text against context. Returns { subject, html, text }.
   */
  render(tmpl, context = {}) {
    return {
      subject: substitute(tmpl.subject || '', context),
      html:    substitute(tmpl.html || '',    context),
      text:    tmpl.text ? substitute(tmpl.text, context) : undefined,
    };
  }
}

/**
 * Replace {{var}} and {{a.b.c}} with values from context. Unknown vars
 * become empty strings (matches Handlebars default so operators with
 * prior exposure aren't surprised). HTML-escape all interpolated values
 * in HTML contexts? For v1 we trust the template author — partners
 * don't edit them, only SpinForge admins do.
 */
function substitute(template, context) {
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
    const parts = path.split('.');
    let cur = context;
    for (const p of parts) {
      if (cur == null) return '';
      cur = cur[p];
    }
    return cur == null ? '' : String(cur);
  });
}

module.exports = EmailTemplateService;
