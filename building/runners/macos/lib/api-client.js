/**
 * Thin HTTP client to building-api over Tailscale.
 *
 * Used for:
 *   - Fetching the workspace zip (GET /_internal/workspaces/:jobId)
 *   - Uploading artifacts (POST /_internal/artifacts/:jobId)
 *
 * Deliberately uses node:https + node:http directly so the runner has no
 * external dep beyond `redis`. Node 22 has a native `fetch` too, but
 * multipart uploads need a bit of setup so we keep the explicit form.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');
const { randomBytes } = require('crypto');

function pickRequester(url) {
  return url.protocol === 'https:' ? https : http;
}

async function fetchWorkspace(apiUrl, jobId, destPath) {
  const url = new URL(`/_internal/workspaces/${jobId}`, apiUrl);
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  const tmp = `${destPath}.part`;

  return new Promise((resolve, reject) => {
    const req = pickRequester(url).get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`fetchWorkspace(${jobId}) → ${res.statusCode}`));
        return;
      }
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', async () => {
        try {
          await fsp.rename(tmp, destPath);
          const st = await fsp.stat(destPath);
          resolve({ path: destPath, bytes: st.size });
        } catch (err) { reject(err); }
      });
      out.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function uploadArtifacts(apiUrl, jobId, files, { kind = null } = {}) {
  if (!files || !files.length) return { artifacts: [] };

  const url = new URL(`/_internal/artifacts/${jobId}`, apiUrl);
  const boundary = `----spinforge${randomBytes(12).toString('hex')}`;

  // Compute content length up front so the server can write directly to
  // disk without a temp buffer. This means streaming each file's bytes
  // in sequence through a single upload request.
  let totalLength = 0;
  const parts = [];
  for (const f of files) {
    const filename = path.basename(f.path);
    const st = await fsp.stat(f.path);
    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="${filename.replace(/"/g, '')}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
    );
    const trailer = Buffer.from('\r\n');
    parts.push({ header, trailer, file: f, size: st.size });
    totalLength += header.length + st.size + trailer.length;
  }
  let endPart = `--${boundary}--\r\n`;
  if (kind) {
    const k = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="kind"\r\n\r\n` +
      `${kind}\r\n`
    );
    totalLength += k.length;
    endPart = k.toString() + endPart;
  }
  totalLength += Buffer.byteLength(endPart);

  return new Promise((resolve, reject) => {
    const req = pickRequester(url).request(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(totalLength),
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); }
          catch (_) { resolve({ raw: body }); }
        } else {
          reject(new Error(`uploadArtifacts ${res.statusCode}: ${body.slice(0, 400)}`));
        }
      });
    });
    req.on('error', reject);

    (async () => {
      try {
        for (const p of parts) {
          req.write(p.header);
          await pipeFileInto(req, p.file.path);
          req.write(p.trailer);
        }
        req.end(endPart);
      } catch (err) {
        req.destroy(err);
      }
    })();
  });
}

function pipeFileInto(req, filePath) {
  return new Promise((resolve, reject) => {
    const src = fs.createReadStream(filePath);
    src.on('error', reject);
    src.on('end', resolve);
    // We pipe without closing the request — multiple files share one body.
    src.pipe(req, { end: false });
  });
}

module.exports = { fetchWorkspace, uploadArtifacts };
