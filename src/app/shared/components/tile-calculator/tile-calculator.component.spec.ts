import {TestBed} from '@angular/core/testing';import {TileCalculatorComponent} from './tile-calculator.component';
const product=(id:string,name:string,unitLabel='Caja')=>({id,masterProductId:id,name,productType:name,brand:'Marca',unitLabel}) as any;
const plan={version:1 as const,priceUnitConfirmed:true as const,spaces:[{name:'Cocina',length:3.5,width:2.8,excludedArea:0}],wastePercent:10,coveragePerBox:2,productId:'tile',productName:'Cerámica de piso'};
function setup(){const fixture=TestBed.createComponent(TileCalculatorComponent);fixture.componentRef.setInput('products',[product('tile','Cerámica de piso'),product('other','Porcelanato esmaltado'),product('glue','Adhesivo para cerámica'),product('brick','Ladrillo cerámico'),product('m2','Cerámica por metro','m²')]);fixture.detectChanges();return {fixture,c:fixture.componentInstance as any};}
it('uses real coverage, requires box-price confirmation, and adds a computed plan only once',async()=>{
 const {fixture,c}=setup();expect(c.matches.map((p:any)=>p.id)).toEqual(['tile','other']);c.form={...structuredClone(plan),priceUnitConfirmed:false};fixture.detectChanges();await fixture.whenStable();expect(c.result.boxes).toBe(6);const button=fixture.nativeElement.querySelector('.apply');expect(button.disabled).toBe(true);
 const emit=vi.spyOn(c.applyPlan,'emit');const checkbox=fixture.nativeElement.querySelector('.confirmation input');checkbox.click();fixture.detectChanges();await fixture.whenStable();expect(button.disabled).toBe(false);button.click();fixture.detectChanges();expect(emit).toHaveBeenCalledWith(plan);expect(button.disabled).toBe(true);button.click();expect(emit).toHaveBeenCalledTimes(1);fixture.destroy();
});
it('supports different spaces and requires reconfirming coverage whenever the selected product changes',async()=>{
 const {fixture,c}=setup();c.form=structuredClone(plan);c.addSpace();c.form.spaces[1]={name:'Pasillo',length:2,width:1,excludedArea:.2};expect(c.result.boxes).toBe(7);c.form.productId='other';c.selectProduct();expect(c.form.coveragePerBox).toBeNull();expect(c.form.priceUnitConfirmed).toBe(false);expect(c.result).toBeNull();c.clearSelection();expect(c.selected).toBeUndefined();c.removeSpace(1);expect(c.form.spaces).toHaveLength(1);fixture.destroy();
});
it('restores saved spaces without mutating them and allows re-adding a removed generated line',()=>{
 const {fixture,c}=setup();fixture.componentRef.setInput('plan',plan);fixture.detectChanges();expect(c.alreadyApplied).toBe(true);c.form.spaces[0].length=8;expect(plan.spaces[0].length).toBe(3.5);fixture.componentRef.setInput('plan',undefined);fixture.detectChanges();expect(c.alreadyApplied).toBe(false);fixture.destroy();
});
