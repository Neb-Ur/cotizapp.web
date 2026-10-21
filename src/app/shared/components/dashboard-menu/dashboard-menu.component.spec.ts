import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DashboardMenuComponent } from './dashboard-menu.component';

describe('responsive dashboard menu', () => {
  let fixture: ComponentFixture<DashboardMenuComponent>;
  let trigger: HTMLButtonElement;
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[DashboardMenuComponent], providers:[provideRouter([])]}).compileComponents();
    fixture = TestBed.createComponent(DashboardMenuComponent);
    fixture.componentRef.setInput('title', 'Panel Admin');
    fixture.componentRef.setInput('sections', [{id:'inicio', label:'Inicio'}, {id:'catalogo', label:'Catálogo'}]);
    fixture.componentRef.setInput('activeSection', 'catalogo');
    trigger = document.createElement('button');
    document.body.append(trigger, fixture.nativeElement);
    fixture.detectChanges();
    trigger.focus();
  });
  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
    trigger.remove();
    document.body.classList.remove('modal-open');
    TestBed.resetTestingModule();
  });
  async function openMenu() {
    fixture.componentRef.setInput('isMobileViewport', true);
    fixture.componentRef.setInput('isMobileOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('aside') as HTMLElement;
  }

  it('exposes the current destination and remains a regular sidebar on desktop', () => {
    expect(fixture.nativeElement.querySelector('[aria-current="page"]').textContent).toContain('Catálogo');
    expect(fixture.nativeElement.querySelector('aside').getAttribute('aria-modal')).toBeNull();
    expect(document.body.classList.contains('surface-open')).toBe(false);
  });

  it('hides the closed mobile drawer from keyboard and assistive technology', () => {
    fixture.componentRef.setInput('isMobileViewport', true); fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('aside');
    expect(menu.hasAttribute('inert')).toBe(true);
    expect(menu.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(trigger);
  });

  it('opens as a modal and restores focus and scrolling on Escape', async () => {
    fixture.componentInstance.menuClosed.subscribe(() => {
      fixture.componentRef.setInput('isMobileOpen', false); fixture.detectChanges();
    });
    const menu = await openMenu();
    expect(menu.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(menu);
    expect(document.body.classList.contains('surface-open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    expect(menu.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(document.body.classList.contains('surface-open')).toBe(false);
  });

  it('traps reverse Tab from initial focus and forward Tab from the last action', async () => {
    const menu = await openMenu();
    const last = menu.querySelector<HTMLElement>('.sidebar-actions button')!;
    menu.dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', shiftKey:true, bubbles:true, cancelable:true}));
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', bubbles:true, cancelable:true}));
    expect(document.activeElement).toBe(menu.querySelector('.sidebar-close'));
  });

  it('releases its lock when resized to desktop or destroyed', async () => {
    await openMenu();
    fixture.componentRef.setInput('isMobileViewport', false); fixture.detectChanges();
    expect(document.body.classList.contains('surface-open')).toBe(false);
    await openMenu(); fixture.destroy();
    expect(document.body.classList.contains('surface-open')).toBe(false);
  });

  it('does not close a surface behind another open modal', async () => {
    const closed = vi.fn(); fixture.componentInstance.menuClosed.subscribe(closed);
    await openMenu(); document.body.classList.add('modal-open');
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    expect(closed).not.toHaveBeenCalled();
  });
});
