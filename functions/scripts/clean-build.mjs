import {rm} from 'node:fs/promises';
// TypeScript does not remove compiled files when a source module is deleted.
await rm(new URL('../lib/',import.meta.url),{recursive:true,force:true});
