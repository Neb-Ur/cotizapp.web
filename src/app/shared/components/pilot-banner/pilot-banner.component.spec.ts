import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { PilotService } from '../../../core/services/pilot.service';
import { PilotBannerComponent } from './pilot-banner.component';

async function setup(enabled = true) {
  const pilot = { enabled: signal(enabled), initialize: vi.fn() };
  await TestBed.configureTestingModule({ imports: [PilotBannerComponent], providers: [{provide: PilotService, useValue: pilot}] }).compileComponents();
  const fixture = TestBed.createComponent(PilotBannerComponent); fixture.detectChanges();
  return {fixture, pilot};
}
afterEach(() => TestBed.resetTestingModule());
it('keeps the notice collapsed until requested and preserves the full warning and feedback link', async () => {
  const {fixture} = await setup();
  const trigger = fixture.nativeElement.querySelector('.pilot-trigger') as HTMLButtonElement;
  expect(trigger.textContent).toContain('En prueba'); expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(fixture.nativeElement.querySelector('aside')).toBeNull();
  trigger.click(); fixture.detectChanges();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(fixture.nativeElement.querySelector('aside').textContent).toContain('No realizan ventas');
  expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/contacto');
  fixture.nativeElement.querySelector('.pilot-close').click(); fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('aside')).toBeNull();
});
it('closes with Escape restoring focus, and closes on outside click without stealing focus', async () => {
  const {fixture} = await setup(); document.body.appendChild(fixture.nativeElement);
  const trigger = fixture.nativeElement.querySelector('.pilot-trigger') as HTMLButtonElement;
  trigger.click(); fixture.detectChanges();
  fixture.nativeElement.querySelector('.pilot-close').focus();
  document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); fixture.detectChanges();
  expect(document.activeElement).toBe(trigger); expect(fixture.nativeElement.querySelector('aside')).toBeNull();
  trigger.click(); fixture.detectChanges(); document.body.click(); fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('aside')).toBeNull(); fixture.nativeElement.remove();
});
it('shows nothing when pilot mode is disabled', async () => {
  const {fixture} = await setup(false); expect(fixture.nativeElement.querySelector('button')).toBeNull();
});
