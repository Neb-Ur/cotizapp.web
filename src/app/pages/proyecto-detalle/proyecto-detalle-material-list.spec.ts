import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { ProyectoDetalleComponent } from './proyecto-detalle.component';
import { DataModeService } from '../../core/services/data-mode.service';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { MaterialListService } from '../../core/services/material-list.service';

describe('material list to saved quotation', () => {
  beforeEach(() => localStorage.clear());
  function setup() {
    const items = [{ productName: 'Cemento', quantity: 3, storeId: 's', productoMaestroId: 'p', productoFerreteriaId: 'o', unitPrice: 5000 }];
    const materialList = { items: () => items, fingerprint: () => JSON.stringify(items), clearIfUnchanged: vi.fn() };
    const route = { snapshot: { queryParamMap: convertToParamMap({ usarLista: '1' }) } };
    const api = { refreshMaestroData: vi.fn(async () => {}), buildProjectQuotation: vi.fn(() => ({ lines: [], optimalTotal: 15000 })), saveProject: vi.fn(async () => ({ id: 'saved' })) };
    const navigate = vi.fn();
    const component = new ProyectoDetalleComponent({ mode: () => 'real' } as unknown as DataModeService,
      route as unknown as ActivatedRoute, { navigate } as unknown as Router,
      { currentUser: () => ({ id: 'maestro', role: 'maestro' }) } as unknown as AuthService,
      api as unknown as FirebaseDataService, undefined, null, null, materialList as unknown as MaterialListService) as any;
    return { component, materialList, api, navigate };
  }
  it('imports the guest quantities and offer identity, then clears only after successful saving', async () => {
    const { component, materialList, api, navigate } = setup();
    await component.loadQuotation('nuevo');
    expect(component.fromMaterialList).toBe(true); expect(component.projectName).toBe('Mi cotización');
    expect(component.projectItems).toEqual([{ productName: 'Cemento', quantity: 3, storeId: 's', productoMaestroId: 'p', productoFerreteriaId: 'o' }]);
    expect(materialList.clearIfUnchanged).not.toHaveBeenCalled();
    component.projectItems[0].quantity = 4; component.persistDraftIfNeeded(); await component.loadQuotation('nuevo');
    expect(component.projectItems[0].quantity).toBe(4);
    await component.saveProject();
    expect(api.saveProject).toHaveBeenCalledWith('maestro', 'Mi cotización', component.projectItems, '', undefined, undefined, undefined, '');
    expect(materialList.clearIfUnchanged).toHaveBeenCalledWith(materialList.fingerprint());
    expect(navigate).toHaveBeenCalledWith(['/dashboard/maestro/cotizaciones', 'saved']);
  });
  it('restores edited materials after a reload instead of overwriting them with the original public list', async () => {
    const first = setup(); await first.component.loadQuotation('nuevo');
    first.component.projectName = 'Obra de cocina'; first.component.projectItems[0].quantity = 4; first.component.persistDraftIfNeeded();
    const reloaded = setup(); await reloaded.component.loadQuotation('nuevo');
    expect(reloaded.component.projectName).toBe('Obra de cocina'); expect(reloaded.component.projectItems[0].quantity).toBe(4);
    expect(reloaded.materialList.clearIfUnchanged).not.toHaveBeenCalled();
  });
  it('keeps the public list and the editor draft if saving fails', async () => {
    const { component, api, materialList, navigate } = setup();
    await component.loadQuotation('nuevo'); api.saveProject.mockRejectedValueOnce(new Error('No se pudo guardar'));
    await component.saveProject();
    expect(component.saveNotice).toContain('No se pudo guardar'); expect(materialList.clearIfUnchanged).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled(); expect(component.readDraft().items).toHaveLength(1);
  });
});
