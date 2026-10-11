import {initializeApp, deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {cloudAuth, cloudPool, secretValue, requireApply, projectId} from './lib/sql-cloud.mjs';

const batchId = 'findi-pilot-2026-10';
async function main() {
  requireApply();
  const disabling = process.argv.includes('--disable');
  const password = process.env.PILOT_AUTH_PASSWORD;
  if (!disabling && (!password || password.length < 6 || password.length > 128)) throw new Error('PILOT_AUTH_PASSWORD_REQUIRED');
  const auth = await cloudAuth();
  const connection = await cloudPool(auth, 'findi_runtime', await secretValue(auth, 'FINDI_SQL_PASSWORD'), 1);
  const app = initializeApp({projectId, credential: {getAccessToken: async () => {
    const token = await auth.getAccessToken();
    if (!token.token) throw new Error('CLOUD_TOKEN_REQUIRED');
    return {access_token: token.token, expires_in: 300};
  }}}, 'pilot-store-auth');
  try {
    const firebase = getAuth(app);
    const rows = (await connection.pool.query(`SELECT u.id, u.api_payload AS profile, s.id AS store_id, s.api_payload AS store
      FROM findi.users u JOIN findi.stores s ON s.owner_id = u.id
      WHERE u.api_payload->>'lotePrueba'=$1 AND s.api_payload->>'lotePrueba'=$1 ORDER BY u.id`, [batchId])).rows;
    if (rows.length !== 4) throw new Error('PILOT_STORE_COUNT_MISMATCH');
    // Validate every reserved identity before changing any authentication account.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.id !== `pilot-owner-${i+1}` || row.store_id !== `pilot-store-${i+1}`
        || row.profile.correo !== `pilot-${i+1}@example.invalid` || row.profile.rol !== 'ferreteria'
        || row.profile.esPrueba !== true || row.store.esPrueba !== true) throw new Error('PILOT_IDENTITY_MISMATCH');
      if (!disabling && (row.profile.estadoCuenta !== 'activo' || row.store.estado !== 'activo')) throw new Error('PILOT_INACTIVE');
      try { row.account = await firebase.getUser(row.id); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      if (row.account && row.account.email !== row.profile.correo) throw new Error('PILOT_AUTH_ID_OCCUPIED');
      try {
        const emailAccount = await firebase.getUserByEmail(row.profile.correo);
        if (emailAccount.uid !== row.id) throw new Error('PILOT_AUTH_EMAIL_OCCUPIED');
      } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    }
    for (const row of rows) {
      let action = 'unchanged';
      if (disabling && row.account) {
        await firebase.updateUser(row.id, {disabled: true});
        await firebase.revokeRefreshTokens(row.id);
        action = 'disabled';
      } else if (!disabling && !row.account) {
        // Reserved .invalid mailboxes belong solely to these synthetic test identities.
        await firebase.createUser({uid: row.id, email: row.profile.correo, password,
          displayName: row.profile.nombre, emailVerified: true, disabled: false});
        action = 'created';
      } else if (!disabling && process.argv.includes('--reset-password')) {
        await firebase.updateUser(row.id, {password, disabled: false});
        await firebase.revokeRefreshTokens(row.id);
        action = 'password-reset';
      }
      console.log(JSON.stringify({storeId: row.store_id, name: row.store.nombreComercial, email: row.profile.correo, action}));
    }
  } finally { await connection.close(); await deleteApp(app); }
}
main().catch(error => { console.error('PILOT_AUTH_FAILED', error.code || (/^[A-Z_]+$/.test(error.message) ? error.message : 'ERROR')); process.exitCode = 1; });
