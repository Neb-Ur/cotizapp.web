import { vi, type Mock, type Mocked } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClientService } from './api-client.service';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../config/api.config';

describe('ApiClientService', () => {
  let client: ApiClientService;
  let http: HttpTestingController;
  let auth: { getToken: Mock };
  beforeEach(() => {
    auth = { getToken: vi.fn().mockReturnValue('session-token') };
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [ApiClientService, { provide: AuthService, useValue: auth }] });
    client = TestBed.inject(ApiClientService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('unwraps public responses and preserves valid query values', async () => {
    const result = client.get<string[]>('/busqueda', false, { query: 'cemento', page: 0, empty: '', missing: undefined });
    const req = http.expectOne(r => r.url === `${API_BASE_URL}/busqueda`);
    expect(req.request.params.keys()).toEqual(['query', 'page']);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ ok: true, data: ['Cemento'] });
    expect(await result).toEqual(['Cemento']);
  });
  for (const method of ['post', 'patch', 'put'] as const) {
    it(`preserves ${method} bodies and bearer authentication`, async () => {
      const body = { name: 'Cotizacion' };
      const result = client[method]<{ id: string }>('/proyectos', body, true);
      const req = http.expectOne(`${API_BASE_URL}/proyectos`);
      expect(req.request.method).toBe(method.toUpperCase());
      expect(req.request.body).toEqual(body);
      expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
      req.flush({ ok: true, data: { id: 'p1' } });
      expect(await result).toEqual({ id: 'p1' });
    });
  }
  it('preserves authenticated deletion', async () => {
    const result = client.delete('/proyectos/p1', true);
    const req = http.expectOne(`${API_BASE_URL}/proyectos/p1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
    req.flush({ ok: true, data: { deleted: true } });
    expect(await result).toEqual({ deleted: true });
  });
  it('rejects missing sessions without sending a request', async () => {
    auth.getToken.mockReturnValue(null);
    await expect(client.get('/proyectos', true)).rejects.toThrow('No hay sesion activa para llamar al backend.');
    http.expectNone(`${API_BASE_URL}/proyectos`);
  });
  it('propagates backend errors for caller handling', async () => {
    const result = client.get('/busqueda');
    const rejection = expect(result).rejects.toBeDefined();
    http.expectOne(`${API_BASE_URL}/busqueda`).flush({ error: { message: 'Error' } }, { status: 500, statusText: 'Server Error' });
    await rejection;
  });
});
