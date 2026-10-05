import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_EMAIL_CONTENT, renderCotizAppEmail, renderFirebaseEmailBody } from '../lib/lib/email-template.js';

test('all account messages keep their action token and security instructions in HTML and text', () => {
  for (const content of Object.values(AUTH_EMAIL_CONTENT)) {
    const { html, text } = renderCotizAppEmail(content);
    assert.ok(html.includes('href="%LINK%"'));
    assert.ok(text.includes('%LINK%'));
    assert.ok(html.includes(content.actionLabel));
    assert.ok(text.includes(content.securityNote));
    assert.ok(html.includes('lang="es"'));
    assert.ok(content.subject.startsWith('CotizApp'));
  }
  assert.ok(renderCotizAppEmail(AUTH_EMAIL_CONTENT.resetPasswordTemplate).html.includes('%EMAIL%'));
  assert.ok(renderCotizAppEmail(AUTH_EMAIL_CONTENT.changeEmailTemplate).html.includes('%NEW_EMAIL%'));
  assert.ok(renderCotizAppEmail(AUTH_EMAIL_CONTENT.revertSecondFactorAdditionTemplate).html.includes('%SECOND_FACTOR%'));
});
test('shared layout escapes user content and rejects executable action links', () => {
  const base = AUTH_EMAIL_CONTENT.resetPasswordTemplate;
  const html = renderCotizAppEmail({ ...base, title: '<img src=x onerror=alert(1)>', introduction: ['A & B'], actionUrl: 'https://example.test/action?a=1&b=2' }).html;
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('A &amp; B'));
  assert.ok(html.includes('href="https://example.test/action?a=1&amp;b=2"'));
  assert.throws(() => renderCotizAppEmail({ ...base, actionUrl: 'javascript:alert(1)' }), /HTTPS/);
});

test('Firebase editor bodies preserve live placeholders and exclude preview addresses and document wrappers', () => {
  for (const content of Object.values(AUTH_EMAIL_CONTENT)) {
    const body = renderFirebaseEmailBody(content);
    assert.ok(body.includes('href="%LINK%"'));
    assert.ok(!body.includes('example.test'));
    assert.ok(!/<(?:!doctype|html|head|body)[\s>]/i.test(body));
    assert.ok(body.includes(content.actionLabel));
  }
  assert.ok(renderFirebaseEmailBody(AUTH_EMAIL_CONTENT.resetPasswordTemplate).includes('%EMAIL%'));
});
