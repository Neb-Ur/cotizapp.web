import { vi } from 'vitest';

// Use one SDK mock before loading shared Angular chunks. Per-file SDK mocks
// can bind AuthService and its assertions to different module instances.
vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');
  return {
    ...actual,
    getIdToken: vi.fn(),
    onIdTokenChanged: vi.fn(),
    reauthenticateWithCredential: vi.fn(),
    updatePassword: vi.fn(),
    reload: vi.fn(),
    sendEmailVerification: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    signOut: vi.fn()
  };
});
