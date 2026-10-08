import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Database } from '../database/port.js';
import { useSqlDatabase } from '../database/config.js';
import { PostgresDatabase } from '../database/postgres.js';
import { sqlPool } from '../database/pool.js';

const app = getApps().length > 0 ? getApps()[0] : initializeApp();

export const adminAuth = getAuth(app);
export const firestoreDb = getFirestore(app);
const postgresDb = new PostgresDatabase({connect: async () => (await sqlPool()).connect()});
// Fixed per process/deployment: never mix storage providers during one request.
export const db: Database = useSqlDatabase() ? postgresDb : firestoreDb as unknown as Database;
