export const EMAIL_SITE_URL = 'https://cotizapp-d71c8.web.app';

export interface EmailContent {
  subject: string;
  title: string;
  introduction: string[];
  actionLabel: string;
  actionUrl?: string;
  securityNote: string;
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

/** Table layout and inline styles; the wordmark stays readable when remote images are blocked. */
export function renderCotizAppEmail(content: EmailContent): { html: string; text: string } {
  const actionUrl = content.actionUrl ?? '%LINK%';
  if (actionUrl !== '%LINK%' && new URL(actionUrl).protocol !== 'https:') {
    throw new Error('Los enlaces de correo deben usar HTTPS.');
  }
  const paragraphs = content.introduction.map(paragraph => `<p style="margin:0 0 16px;color:#36536e;font-size:16px;line-height:26px">${escape(paragraph)}</p>`).join('\n');
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(content.subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#0f2d4a">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escape(content.introduction[0] ?? content.title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f5f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border:1px solid #dce2e9;border-radius:16px;background-color:#ffffff;overflow:hidden">
<tr><td bgcolor="#0f2d4a" style="padding:28px 24px;border-radius:15px 15px 0 0">
<a href="${EMAIL_SITE_URL}" style="text-decoration:none;color:#ffffff;font-size:30px;line-height:36px;font-weight:800"><img src="${EMAIL_SITE_URL}/assets/trovio-icon-192.png" width="44" height="44" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:10px">trov<span style="color:#ff7a00">i</span>o</a>
<p style="margin:7px 0 0;color:#dce2e9;font-size:11px;line-height:17px;letter-spacing:2px;text-transform:uppercase">Encontrar. Comparar. Construir mejor.</p>
</td></tr>
<tr><td style="padding:30px 24px 24px">
<p style="margin:0 0 12px;color:#6b7280;font-size:12px;line-height:18px;letter-spacing:1px;text-transform:uppercase">Tu cuenta Trovio</p>
<h1 style="margin:0 0 20px;color:#0f2d4a;font-size:28px;line-height:36px;font-weight:700">${escape(content.title)}</h1>
${paragraphs}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td align="center" bgcolor="#a94700" style="border-radius:8px"><a href="${escape(actionUrl)}" style="display:inline-block;padding:16px 24px;border:1px solid #a94700;border-radius:8px;background-color:#a94700;color:#ffffff;text-decoration:none;font-size:16px;line-height:22px;font-weight:700;mso-padding-alt:0">${escape(content.actionLabel)}</a></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#f3f5f8" style="padding:16px;border-left:3px solid #ff7a00;border-radius:4px"><p style="margin:0;color:#36536e;font-size:14px;line-height:22px">${escape(content.securityNote)}</p></td></tr></table>
<p style="margin:24px 0 6px;color:#6b7280;font-size:13px;line-height:21px">Si el botón no funciona, copia este enlace en tu navegador:</p>
<p style="margin:0;word-break:break-all;overflow-wrap:anywhere;font-size:12px;line-height:20px"><a href="${escape(actionUrl)}" style="color:#36536e;text-decoration:underline">${escape(actionUrl)}</a></p>
<p style="margin:24px 0 0;color:#36536e;font-size:14px;line-height:22px">Equipo Trovio</p>
</td></tr>
<tr><td bgcolor="#f3f5f8" style="padding:20px 24px;border-top:1px solid #e7ebf0;border-radius:0 0 15px 15px">
<p style="margin:0 0 12px;color:#6b7280;font-size:12px;line-height:20px">Este es un correo automático relacionado con la seguridad de tu cuenta. Trovio nunca te pedirá tu contraseña por correo.</p>
<p style="margin:0;font-size:12px;line-height:20px"><a href="${EMAIL_SITE_URL}/contacto" style="color:#36536e;text-decoration:underline">Contacto</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${EMAIL_SITE_URL}/privacidad" style="color:#36536e;text-decoration:underline">Privacidad</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${EMAIL_SITE_URL}/terminos-condiciones" style="color:#36536e;text-decoration:underline">Términos</a></p>
</td></tr></table>
</td></tr></table></body></html>`;
  const text = ['Trovio · Encontrar. Comparar. Construir mejor.', '', content.title, '', ...content.introduction, '', `${content.actionLabel}: ${actionUrl}`, '', content.securityNote, '', 'Equipo Trovio', 'Trovio nunca te pedirá tu contraseña por correo.', `Contacto: ${EMAIL_SITE_URL}/contacto`, `Privacidad: ${EMAIL_SITE_URL}/privacidad`].join('\n');
  return { html, text };
}

/** Firebase's message editor takes the body fragment, retaining its own document wrapper. */
export function renderFirebaseEmailBody(content: EmailContent): string {
  const html = renderCotizAppEmail(content).html;
  const start = html.indexOf('>', html.indexOf('<body ')) + 1;
  const end = html.lastIndexOf('</body>');
  return `<div lang="es" style="margin:0;padding:0;background-color:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#0f2d4a">${html.slice(start, end)}</div>`;
}

export const AUTH_EMAIL_CONTENT: Record<string, EmailContent> = {
  resetPasswordTemplate: {
    subject: 'Trovio · Restablece tu contraseña',
    title: 'Recupera el acceso a tu cuenta',
    introduction: ['Recibimos una solicitud para restablecer la contraseña de tu cuenta Trovio asociada a %EMAIL%.', 'Usa el siguiente botón para elegir una contraseña nueva.'],
    actionLabel: 'Restablecer contraseña',
    securityNote: 'Si no solicitaste este cambio, ignora este correo. Tu contraseña seguirá siendo la misma. No compartas este enlace.'
  },
  verifyEmailTemplate: {
    subject: 'Trovio · Verifica tu correo electrónico',
    title: 'Confirma tu correo electrónico',
    introduction: ['Verifica el correo %EMAIL% para completar la seguridad de tu cuenta Trovio.', 'Confirma que esta dirección te pertenece con el siguiente botón.'],
    actionLabel: 'Verificar correo',
    securityNote: 'Si no creaste esta cuenta o no solicitaste la verificación, ignora este correo. No compartas este enlace.'
  },
  changeEmailTemplate: {
    subject: 'Trovio · Tu correo de acceso cambió',
    title: 'Cambio de correo electrónico',
    introduction: ['El correo de acceso de tu cuenta Trovio cambió a %NEW_EMAIL%.', 'Si realizaste este cambio, no necesitas hacer nada. Si no lo reconoces, usa el siguiente botón para recuperar tu dirección anterior.'],
    actionLabel: 'Revertir cambio de correo',
    securityNote: 'Este enlace permite revertir el cambio. Úsalo únicamente si no autorizaste la actualización de tu correo y no lo compartas.'
  },
  revertSecondFactorAdditionTemplate: {
    subject: 'Trovio · Se activó la verificación en dos pasos',
    title: 'Nueva protección para tu cuenta',
    introduction: ['Se añadió %SECOND_FACTOR% como método de verificación en dos pasos a tu cuenta Trovio.', 'Si realizaste esta acción, no necesitas hacer nada. Si no la reconoces, usa el siguiente botón para retirar el método añadido.'],
    actionLabel: 'Retirar método no reconocido',
    securityNote: 'Este botón retira el método de seguridad recién añadido. Úsalo solo si no autorizaste esta acción y revisa la contraseña de tu cuenta.'
  }
};
