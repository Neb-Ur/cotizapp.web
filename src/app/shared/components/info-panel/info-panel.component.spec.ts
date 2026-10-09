import { TestBed } from '@angular/core/testing';
import { InfoPanelComponent } from './info-panel.component';

function mouseEnter(element: HTMLElement): void {
  const event = new Event('pointerenter');
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  element.dispatchEvent(event);
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [InfoPanelComponent] }).compileComponents();
  const fixture = TestBed.createComponent(InfoPanelComponent);
  fixture.detectChanges();
  const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  return { fixture, button };
}

describe('information popover', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('opens on hover, stays open while reading the popover, and closes on leaving', async () => {
    const { fixture, button } = await setup();
    mouseEnter(button); fixture.detectChanges();
    const panel = document.querySelector('.cdk-overlay-container [role="dialog"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(document.querySelector('.cdk-overlay-backdrop')).toBeNull();
    button.dispatchEvent(new Event('pointerleave'));
    mouseEnter(panel);
    await new Promise(resolve => setTimeout(resolve, 180)); fixture.detectChanges();
    expect(document.body.contains(panel)).toBe(true);
    panel.dispatchEvent(new Event('pointerleave'));
    await new Promise(resolve => setTimeout(resolve, 180)); fixture.detectChanges();
    expect(document.body.contains(panel)).toBe(false);
  });

  it('toggles on touch/click and closes on an outside click', () => {
    return setup().then(async ({ fixture, button }) => {
      button.click(); fixture.detectChanges();
      expect(button.getAttribute('aria-expanded')).toBe('true');
      button.click(); fixture.detectChanges();
      expect(button.getAttribute('aria-expanded')).toBe('false');
      button.click(); fixture.detectChanges();
      await fixture.whenStable();
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      document.body.click(); fixture.detectChanges();
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('opens for keyboard focus and closes with Escape without reopening on focus', async () => {
    const { fixture, button } = await setup();
    button.focus(); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });
});
