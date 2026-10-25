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
    refreshMaestroProjectsSection: vi.fn(async (): Promise<void> => undefined),
    getProjects: vi.fn(() => projects),
    deleteProject: vi.fn(async () => undefined),
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

  return { component, apiService, router, authService };
}

describe('DashboardMaestroComponent', () => {
  it('preserves a quotation until its deletion is explicitly confirmed', async () => {
    const { component, apiService } = createComponent();
    component['projects'] = [{id:'p1', name:'Cocina'}] as never;
    component['deleteProject']('p1');
    expect(apiService.deleteProject).not.toHaveBeenCalled();
    expect(component['quotationToDelete']?.name).toBe('Cocina');
    component['closeDeleteQuotation']();
    expect(component['quotationToDelete']).toBeNull();
    component['deleteProject']('p1');
    await component['confirmDeleteQuotation']();
    expect(apiService.deleteProject).toHaveBeenCalledExactlyOnceWith('maestro-1', 'p1');
    expect(component['quotationToDelete']).toBeNull();
  });

  it('keeps a failed deletion recoverable and ignores double confirmation', async () => {
    const { component, apiService } = createComponent();
    component['projects'] = [{id:'p1', name:'Cocina'}] as never;
    let rejectDelete!: (error: Error) => void;
    apiService.deleteProject.mockImplementationOnce(() => new Promise((_resolve, reject) => {rejectDelete = reject;}));
    component['deleteProject']('p1');
    const request = component['confirmDeleteQuotation']();
    await component['confirmDeleteQuotation']();
    component['closeDeleteQuotation']();
    expect(component['quotationToDelete']?.id).toBe('p1');
    expect(apiService.deleteProject).toHaveBeenCalledTimes(1);
    rejectDelete(new Error('Conexión interrumpida')); await request;
    expect(component['deletionError']).toContain('Conexión interrumpida');
    expect(component['deletingQuotation']).toBe(false);
    expect(component['quotationToDelete']?.id).toBe('p1');
  });
  it('blocks a new quotation when the maestro already has 50 saved quotations', () => {
    const { component, router } = createComponent();
    component['projects'] = Array.from({length:50},(_,i)=>({id:`p${i}`})) as never;

    component['goToNewProject']();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component['quotationNotice']).toContain('Ya tienes 50 cotizaciones guardadas');
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

    expect(component['quotationLimitText']).toBe('1/50 cotizaciones guardadas');
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
  it('does not apply a previous account response after the active account changes', async () => {
    const { component, apiService, authService } = createComponent([
      { id: 'private-project', createdAt: '2026-10-01T00:00:00.000Z' }
    ]);
    let resolveLoad!: () => void;
    apiService.refreshMaestroProjectsSection.mockImplementationOnce(() => new Promise<void>(resolve => { resolveLoad = resolve; }));
    const pendingLoad = component['ensureSectionData']('cotizaciones');
    authService.currentUser = () => ({ id: 'maestro-2', role: 'maestro', displayName: 'Otra cuenta', email: 'otra@test.cl' });
    resolveLoad();
    await pendingLoad;
    expect(apiService.getProjects).not.toHaveBeenCalled();
    expect(component['projects']).toEqual([]);
    expect(component['loadedSections'].has('cotizaciones')).toBe(false);
  });
});

describe('quotation tracking and reuse',()=>{
 it('updates a status only after the server succeeds and retains the previous state on failure',async()=>{
  const {component,apiService}=createComponent();const c:any=component;const api:any=apiService;
  const project={id:'p1',name:'Casa',workflowStatus:'draft',verificationCode:'TRV-CODE'};c.projects=[project];
  api.updateProjectStatus=vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({...project,workflowStatus:'sent'});
  await c.changeProjectStatus(project,'sent');expect(c.projects[0].workflowStatus).toBe('draft');expect(c.quotationNotice).toContain('Sin conexión');expect(c.statusBusyId).toBe('');
  await c.changeProjectStatus(project,'sent');expect(c.projects[0].workflowStatus).toBe('sent');expect(api.updateProjectStatus).toHaveBeenCalledWith('maestro-1','p1','sent','draft','TRV-CODE');
 });
 it('duplicates once, opens the new draft and respects the existing quota',async()=>{
  const {component,apiService,router}=createComponent();const c:any=component;const api:any=apiService;const project={id:'p1',name:'Casa'};c.projects=[project];
  let finish!:(v:any)=>void;api.duplicateProject=vi.fn(()=>new Promise(resolve=>finish=resolve));
  const pending=c.duplicateProject(project);await c.duplicateProject(project);expect(api.duplicateProject).toHaveBeenCalledTimes(1);
  finish({id:'copy',name:'Copia de Casa',workflowStatus:'draft'});await pending;expect(router.navigate).toHaveBeenCalledWith(['/dashboard/maestro/cotizaciones','copy'],{queryParams:{duplicada:'1'}});
  c.projects=Array.from({length:50},(_,i)=>({id:`p${i}`}));
  await c.duplicateProject(project);expect(api.duplicateProject).toHaveBeenCalledTimes(1);expect(c.quotationNotice).toContain('50 cotizaciones');
 });
});
