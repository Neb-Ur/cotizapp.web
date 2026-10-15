import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DashboardMaestroComponent } from './dashboard-maestro.component';

function createComponent(projects: Array<Record<string, unknown>> = []) {
  const authService = {
    currentUser: () => ({ id: 'maestro-1', role: 'maestro', displayName: 'Ana', email: 'ana@test.cl' })
  };
  const apiService = {
    loadError: () => '',
    refreshMaestroProjectsSection: vi.fn(async () => undefined),
    getProjects: vi.fn(() => projects),
    formatCurrency: (value: number) => `$${value}`
  };
  const route = { queryParamMap: of(convertToParamMap({})) };
  const router = { navigate: vi.fn() };

  const component = new DashboardMaestroComponent(
    authService as never,
    apiService as never,
    route as never,
    router as never
  );

  return { component, apiService, router };
}

describe('DashboardMaestroComponent', () => {
  it('blocks a new quotation when the maestro already has 2 saved quotations', () => {
    const { component, router } = createComponent();
    component['projects'] = [{ id: 'p1' }, { id: 'p2' }] as never;

    component['goToNewProject']();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component['quotationNotice']).toContain('Ya tienes 2 cotizaciones guardadas');
  });

  it('navigates to the new quotation form when under the limit', () => {
    const { component, router } = createComponent();
    component['projects'] = [];

    component['goToNewProject']();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/maestro/cotizaciones/nuevo']);
    expect(component['quotationNotice']).toBe('');
  });

  it('sums the estimated saving across saved quotations', () => {
    const { component } = createComponent();
    component['projects'] = [{ saving: 1200 }, { saving: 300 }, { saving: 0 }] as never;

    expect(component['totalEstimatedSaving']).toBe(1500);
  });

  it('reports the quotation limit and whether a new one can be created', () => {
    const { component } = createComponent();
    component['projects'] = [{ id: 'p1' }] as never;

    expect(component['quotationLimitText']).toBe('1/2 cotizaciones guardadas');
    expect(component['canCreateQuotation']).toBe(true);
  });

  it('does not load maestro project data for the catalog section', async () => {
    const { component, apiService } = createComponent();

    await component['ensureSectionData']('buscar');

    expect(apiService.refreshMaestroProjectsSection).not.toHaveBeenCalled();
  });

  it('loads maestro projects for the cotizaciones section', async () => {
    const { component, apiService } = createComponent([
      { id: 'p1', createdAt: '2026-10-01T00:00:00.000Z', saving: 0 }
    ]);

    await component['ensureSectionData']('cotizaciones');

    expect(apiService.refreshMaestroProjectsSection).toHaveBeenCalledWith('maestro-1', false);
    expect(component['projects'].length).toBe(1);
  });
});
