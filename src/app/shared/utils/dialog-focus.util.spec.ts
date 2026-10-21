import { dialogFocusables, trapDialogFocus } from './dialog-focus.util';

describe('dialog keyboard boundaries', () => {
  let dialog: HTMLElement;
  beforeEach(() => {
    dialog = document.createElement('section');
    dialog.tabIndex = -1;
    dialog.innerHTML = '<button id="first">Cerrar</button><input tabindex="-1"><input type="hidden"><fieldset disabled><input></fieldset><div hidden><button>Oculto</button></div><div style="display:none"><button>Oculto</button></div><button id="last">Conservar</button>';
    document.body.append(dialog);
  });
  afterEach(() => dialog.remove());

  it('excludes honeypots, hidden ancestors and disabled fieldsets', () => {
    expect(dialogFocusables(dialog).map(element => element.id)).toEqual(['first', 'last']);
  });

  it('keeps reverse Tab inside from the initial dialog focus', () => {
    dialog.focus();
    const event = new KeyboardEvent('keydown', {key:'Tab', shiftKey:true, cancelable:true});
    trapDialogFocus(dialog, event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('last');
  });

  it('wraps forward and backward at the visible keyboard boundaries', () => {
    dialog.querySelector<HTMLElement>('#last')!.focus();
    trapDialogFocus(dialog, new KeyboardEvent('keydown', {key:'Tab', cancelable:true}));
    expect(document.activeElement?.id).toBe('first');
    trapDialogFocus(dialog, new KeyboardEvent('keydown', {key:'Tab', shiftKey:true, cancelable:true}));
    expect(document.activeElement?.id).toBe('last');
  });

  it('keeps focus on an empty dialog', () => {
    dialog.innerHTML = '<input tabindex="-1">';
    const event = new KeyboardEvent('keydown', {key:'Tab', cancelable:true});
    trapDialogFocus(dialog, event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });
});
