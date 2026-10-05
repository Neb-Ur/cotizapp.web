import { TestBed } from '@angular/core/testing';
import { DataModeService } from './data-mode.service';

describe('single business environment', () => {
  let service: DataModeService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataModeService);
  });
  it('removes obsolete admin selections without touching other preferences', async () => {
    localStorage.setItem('cotizapp-admin-data-mode:admin', 'retired');
    localStorage.setItem('cookie-consent', 'accepted');
    await service.initialize();
    service.setAccount('admin', 'admin');
    expect(service.mode()).toBe('real');
    expect(localStorage.getItem('cotizapp-admin-data-mode:admin')).toBeNull();
    expect(localStorage.getItem('cookie-consent')).toBe('accepted');
  });
  it('sends administrator credentials without an environment override and clears them on logout', () => {
    service.setAccount('admin', 'admin');
    expect(service.requestHeaders('token', false).get('Authorization')).toBe('Bearer token');
    expect(service.requestHeaders('token', false).has('X-Data-Mode')).toBe(false);
    service.setAccount('', '');
    expect(service.requestHeaders('token', false).has('Authorization')).toBe(false);
  });
  it('only sends ordinary account credentials for authenticated calls', () => {
    service.setAccount('user', 'maestro');
    expect(service.requestHeaders('token', false).has('Authorization')).toBe(false);
    expect(service.requestHeaders('token').get('Authorization')).toBe('Bearer token');
    expect(service.mode()).toBe('real');
  });
});
