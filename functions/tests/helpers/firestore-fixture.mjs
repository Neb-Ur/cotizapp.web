import { collectionForMode } from '../../lib/lib/data-mode.js';
import { db } from '../../lib/lib/firebase.js';

// In-memory Firestore boundary: production services run unchanged, with no network.
export function firestoreFixture(t, seed = {}) {
  const data = new Map(Object.entries(seed).map(([name, docs]) => [collectionForMode(name), new Map(Object.entries(docs))]));
  let sequence = 0;
  const table = name => { if (!data.has(name)) data.set(name, new Map()); return data.get(name); };
  const snapshot = ref => ({ id: ref.id, exists: table(ref.name).has(ref.id), data: () => structuredClone(table(ref.name).get(ref.id)) });
  const collection = (name, filters = []) => ({
    name,
    doc(id = `generated-${++sequence}`) {
      const ref = { name, id, get: async () => snapshot(ref),
        set: async (value, options) => table(name).set(id, options?.merge ? { ...table(name).get(id), ...value } : value),
        update: async value => { if (!table(name).has(id)) throw new Error('Missing document'); table(name).set(id, { ...table(name).get(id), ...value }); },
        delete: async () => table(name).delete(id) };
      return ref;
    },
    where(field, op, value) { if (op !== '==') throw new Error(`Unsupported query ${op}`); return collection(name, [...filters, [field, value]]); },
    async get() {
      const docs = [...table(name)].filter(([, value]) => filters.every(([field, expected]) => value[field] === expected))
        .map(([id]) => snapshot({ name, id }));
      return { docs, empty: !docs.length, size: docs.length };
    }
  });
  t.mock.method(db, 'collection', collection);
  t.mock.method(db, 'batch', () => {
    const operations = [];
    return { set: (ref, value, options) => operations.push(() => ref.set(value, options)), delete: ref => operations.push(() => ref.delete()), update: (ref, value) => operations.push(() => ref.update(value)), commit: async () => { for (const op of operations) await op(); } };
  });
  t.mock.method(db, 'runTransaction', async callback => {
    const operations = [];
    let writing = false;
    const result = await callback({
      get: async ref => { if (writing) throw new Error('Transaction read after write'); return ref.get(); },
      create: (ref, value) => { writing = true; operations.push(async () => { if (table(ref.name).has(ref.id)) throw new Error('Already exists'); await ref.set(value); }); },
      set: (ref, value, options) => { writing = true; operations.push(() => ref.set(value, options)); },
      update: (ref, value) => { writing = true; operations.push(() => ref.update(value)); }
    });
    for (const operation of operations) await operation();
    return result;
  });
  return { rows: name => [...table(collectionForMode(name))].map(([id, value]) => ({ id, ...structuredClone(value) })), get: (name, id) => structuredClone(table(collectionForMode(name)).get(id)) };
}
