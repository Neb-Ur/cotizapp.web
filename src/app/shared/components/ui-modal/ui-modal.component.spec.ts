import { vi, type Mock, type Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { UiModalComponent } from './ui-modal.component';

describe('UiModalComponent', () => {
  let fixture: ComponentFixture<UiModalComponent>;
  let component: UiModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UiModalComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.eyebrow = 'Cotización';
    component.title = 'Crear proyecto';
    fixture.detectChanges();
  });

  it('renders an accessible dialog with its hierarchy', () => {
    const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
    const heading = fixture.debugElement.query(By.css('h2'));

    expect(dialog).toBeTruthy();
    expect(dialog.attributes['aria-modal']).toBe('true');
    expect(heading.nativeElement.textContent.trim()).toBe('Crear proyecto');
    expect(dialog.attributes['aria-labelledby']).toBe(heading.attributes['id']);
  });

  it('emits close when Escape is pressed', () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('keeps Shift+Tab inside from the initial dialog focus', () => {
    document.body.append(fixture.nativeElement);
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    dialog.focus();
    const event = new KeyboardEvent('keydown', {key:'Tab', shiftKey:true, bubbles:true, cancelable:true});
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('.close-button'));
    fixture.nativeElement.remove();
  });

  it('does not close while the parent operation is locked', () => {
    const closed = vi.fn();
    component.closeDisabled = true;
    component.closed.subscribe(closed);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.close-button')).nativeElement.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).not.toHaveBeenCalled();
  });
});

it('renders fullscreen mobile wizards outside transformed panels and removes the portal on close',async()=>{
 await TestBed.configureTestingModule({imports:[UiModalComponent]}).compileComponents();
 const fixture=TestBed.createComponent(UiModalComponent);fixture.componentRef.setInput('fullscreenMobile',true);fixture.componentRef.setInput('open',true);fixture.detectChanges();
 expect(document.body.querySelector('.trovio-modal-portal [role=dialog]')).toBeTruthy();expect(fixture.nativeElement.querySelector('.overlay')).toBeNull();
 fixture.componentRef.setInput('open',false);fixture.detectChanges();expect(document.body.querySelector('.trovio-modal-portal')).toBeNull();fixture.destroy();
});
