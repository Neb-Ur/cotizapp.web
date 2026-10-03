import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID;
const confirmedProjectId = process.env.CONFIRM_PROJECT_ID;
const applyChanges = process.argv.includes('--apply');

if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID es obligatorio.');
}

if (applyChanges && confirmedProjectId !== projectId) {
  throw new Error('Para aplicar cambios, CONFIRM_PROJECT_ID debe coincidir exactamente con FIREBASE_PROJECT_ID.');
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const demoUsers = [];
let pageToken;

do {
  const page = await auth.listUsers(1000, pageToken);
  demoUsers.push(...page.users.filter((user) => user.email?.toLowerCase().endsWith('@demo.cl')));
  pageToken = page.pageToken;
} while (pageToken);

if (demoUsers.length === 0) {
  console.log(JSON.stringify({ projectId, mode: applyChanges ? 'apply' : 'dry-run', matched: 0 }, null, 2));
  process.exit(0);
}

if (applyChanges) {
  for (const user of demoUsers) {
    await auth.updateUser(user.uid, { disabled: true });
    await auth.revokeRefreshTokens(user.uid);
  }
}

console.log(JSON.stringify({
  projectId,
  mode: applyChanges ? 'apply' : 'dry-run',
  matched: demoUsers.length,
  accounts: demoUsers.map((user) => ({
    uid: user.uid,
    email: user.email,
    alreadyDisabled: user.disabled
  }))
}, null, 2));

if (!applyChanges) {
  console.log('No se modificó Firebase. Repite con --apply y CONFIRM_PROJECT_ID para deshabilitar cuentas y revocar sesiones.');
}
