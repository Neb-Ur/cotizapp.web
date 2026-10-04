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
