import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { AUTH_EMAIL_CONTENT, renderCotizAppEmail, renderFirebaseEmailBody } from '../lib/lib/email-template.js';

const projectId = process.env.FIREBASE_PROJECT_ID;
const apply = process.argv.includes('--apply');
const previewIndex = process.argv.indexOf('--preview');

async function main() {
  if (previewIndex !== -1) {
    const destination = process.argv[previewIndex + 1];
    if (!destination || destination.startsWith('--')) throw new Error('--preview requiere un directorio.');
    await mkdir(destination, { recursive: true });
    for (const [key, content] of Object.entries(AUTH_EMAIL_CONTENT)) {
      const rendered = renderCotizAppEmail(content);
      const mode = { resetPasswordTemplate: 'resetPassword', verifyEmailTemplate: 'verifyEmail', changeEmailTemplate: 'recoverEmail', revertSecondFactorAdditionTemplate: 'revertSecondFactorAddition' }[key];
      const sample = value => value.replaceAll('%EMAIL%', 'usuario@example.test').replaceAll('%NEW_EMAIL%', 'nuevo@example.test').replaceAll('%SECOND_FACTOR%', 'una aplicación de autenticación').replaceAll('%LINK%', `https://cotizapp-d71c8.firebaseapp.com/__/auth/action?mode=${mode}&lang=es`);
      await writeFile(resolve(destination, `${key}.html`), sample(rendered.html));
      await writeFile(resolve(destination, `${key}.txt`), sample(rendered.text));
      await writeFile(resolve(destination, `${key}.firebase.html`), renderFirebaseEmailBody(content));
    }
    console.log(JSON.stringify({ previews: resolve(destination), count: Object.keys(AUTH_EMAIL_CONTENT).length }));
    if (!apply) return;
  }
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID es obligatorio.');
  if (apply && process.env.CONFIRM_PROJECT_ID !== projectId) throw new Error('CONFIRM_PROJECT_ID debe coincidir con FIREBASE_PROJECT_ID.');

  let auth;
  if (process.argv.includes('--firebase-cli-auth')) {
    const config = JSON.parse(await readFile(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'));
    if (!config.tokens?.access_token || config.tokens.expires_at < Date.now() + 60000) throw new Error('Se necesita una sesión vigente de Firebase CLI.');
    auth = new OAuth2Client();
    auth.setCredentials({ access_token: config.tokens.access_token, expiry_date: config.tokens.expires_at });
  } else {
    auth = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase'] }).getClient();
  }
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config`;
  const read = async () => (await auth.request({ url })).data;
  const patch = async (data, fields) => auth.request({ url, method: 'PATCH', params: { updateMask: fields.join(',') }, data });
  const before = await read();
  const templates = Object.keys(AUTH_EMAIL_CONTENT).filter(key => before.notification?.sendEmail?.[key]);
  if (!templates.length) throw new Error('No se encontraron plantillas de correo en el proyecto.');
  if (!apply) {
    console.log(JSON.stringify({ projectId, mode: 'dry-run', locale: 'es', templates: templates.map(key => ({ key, senderDisplayName: 'Trovio', subject: AUTH_EMAIL_CONTENT[key].subject })) }, null, 2));
    return;
  }
  if (!process.env.EMAIL_TEMPLATE_BACKUP_PATH) throw new Error('EMAIL_TEMPLATE_BACKUP_PATH es obligatorio para conservar una copia de las plantillas actuales.');
  // Back up only email templates and locale; never SMTP credentials or project auth settings.
  await writeFile(process.env.EMAIL_TEMPLATE_BACKUP_PATH, JSON.stringify({ projectId, defaultLocale: before.notification.defaultLocale, templates: Object.fromEntries(templates.map(key => [key, before.notification.sendEmail[key]])) }, null, 2), { mode: 0o600, flag: 'wx' });
  await patch({ notification: { defaultLocale: 'es' } }, ['notification.defaultLocale']);
  const results = [];
  for (const key of templates) {
    const content = AUTH_EMAIL_CONTENT[key];
    const template = { senderDisplayName: 'Trovio', subject: content.subject, body: renderFirebaseEmailBody(content), bodyFormat: 'HTML' };
    const applied = [];
    const blocked = [];
    // Use individual masks: a protected body/subject must not prevent editable fields from updating.
    for (const fields of [['senderDisplayName'], ['subject'], ['body', 'bodyFormat']]) {
      try {
        await patch({ notification: { sendEmail: { [key]: Object.fromEntries(fields.map(field => [field, template[field]])) } } }, fields.map(field => `notification.sendEmail.${key}.${field}`));
        applied.push(...fields);
      } catch (error) {
        const reason = error.response?.data?.error?.message || '';
        if (!reason.includes('EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED')) throw error;
        blocked.push(...fields);
      }
    }
    results.push({ key, applied, blocked });
  }
  const after = await read();
  if (after.notification.defaultLocale !== 'es') throw new Error('No se conservó el idioma español.');
  for (const result of results) {
    const saved = after.notification.sendEmail[result.key];
    const expected = AUTH_EMAIL_CONTENT[result.key];
    if (result.applied.includes('senderDisplayName') && saved.senderDisplayName !== 'Trovio') throw new Error(`El remitente no se conservó en ${result.key}.`);
    // Some protected fields return success while retaining the built-in template.
    for (const [field, value] of [['subject', expected.subject], ['body', renderFirebaseEmailBody(expected)]]) {
      if (result.applied.includes(field) && saved[field] !== value) {
        result.applied = result.applied.filter(appliedField => appliedField !== field);
        result.blocked.push(field);
      }
    }
  }
  const complete = results.every(result => !result.blocked.length);
  console.log(JSON.stringify({ ok: complete, verified: true, status: complete ? 'complete' : 'partial', projectId, locale: 'es', templates: results, backup: process.env.EMAIL_TEMPLATE_BACKUP_PATH }, null, 2));
  if (!complete) process.exitCode = 2;
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, code: error.response?.status ?? error.code, message: error.response?.data?.error?.message || error.message }));
  process.exitCode = 1;
});
