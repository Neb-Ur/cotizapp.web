import { vi } from 'vitest';

// Use one SDK mock before loading shared Angular chunks. Per-file SDK mocks
// can bind AuthService and its assertions to different module instances.
vi.mock('firebase/auth', { spy: true });
