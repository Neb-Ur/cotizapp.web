import {PaintingCalculatorComponent} from './painting-calculator.component';
import {TestBed} from '@angular/core/testing';
it('requires a catalog product, renders computed packages and emits one complete plan',async()=>{
 await TestBed.configureTestingModule({imports:[PaintingCalculatorComponent]}).compileComponents();
 const fixture=TestBed.createComponent(PaintingCalculatorComponent);const c:any=fixture.componentInstance;
 c.products=[{id:'paint',name:'Pintura blanca',productType:'Látex',brand:'Marca'}];
 c.form={version:1,length:5,height:4,surfaces:2,openings:4,coats:2,coverage:10,wastePercent:10,packLiters:4,productId:'paint',productName:'Pintura blanca'};
 const plans:any[]=[];c.applyPlan.subscribe((p:any)=>plans.push(p));fixture.detectChanges();
 expect(fixture.nativeElement.textContent).toContain('Envases completos');expect(c.result.packages).toBe(2);
 c.add();c.add();expect(plans).toHaveLength(1);expect(plans[0].packLiters).toBe(4);
 c.form.coverage=null;c.add();expect(plans).toHaveLength(1);expect(c.result).toBeNull();fixture.destroy();
});
it('requires confirming yield and package volume again when the selected paint changes',()=>{
 const c:any=new PaintingCalculatorComponent();c.products=[{id:'paint',name:'Pintura'}];c.form.productId='paint';c.form.coverage=10;c.form.packLiters=4;c.selectProduct();expect(c.form.coverage).toBeNull();expect(c.form.packLiters).toBeNull();
});
