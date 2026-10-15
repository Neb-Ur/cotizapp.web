import { AuthService } from './auth.service';

describe('AuthService.dashboardRouteForRole', () => {
  const service = Object.create(AuthService.prototype) as AuthService;

  it('sends each role to its own panel', () => {
    expect(service.dashboardRouteForRole('maestro')).toBe('/dashboard/maestro');
    expect(service.dashboardRouteForRole('ferreteria')).toBe('/dashboard/ferreteria');
    expect(service.dashboardRouteForRole('admin')).toBe('/dashboard/admin/validaciones');
  });

  it('sends unknown roles to the home page', () => {
    expect(service.dashboardRouteForRole('visitante' as any)).toBe('/');
  });

  it('returns the login route when there is no user', () => {
    expect(service.dashboardRouteForUser(null)).toBe('/login');
  });
});
