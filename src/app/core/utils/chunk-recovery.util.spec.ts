import { vi } from 'vitest';
import { recoverChunkNavigationError } from './chunk-recovery.util';
function browser() {
  const values = new Map<string,string>();
  return { location: { origin:'https://trovio.test',href:'https://trovio.test/productos/cemento',replace:vi.fn() }, navigator:{onLine:true},
    sessionStorage: { getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);} } };
}
describe('lazy route version recovery',()=>{
  it('reopens the intended quotation route once and retains its query and local storage',()=>{
    localStorage.setItem('trovio-guest-quotations:v1','preserved'); const page=browser(); const error=new TypeError('Failed to fetch dynamically imported module: chunk-OLD.js');
    expect(recoverChunkNavigationError(error,'/cotizaciones/local/quote-1?cantidad=3',page,100000)).toBe(true);
    expect(page.location.replace).toHaveBeenCalledWith('/cotizaciones/local/quote-1?cantidad=3&_actualizar=1');
    expect(localStorage.getItem('trovio-guest-quotations:v1')).toBe('preserved');
    expect(recoverChunkNavigationError(error,'/cotizaciones/local/quote-1',page,100001)).toBe(false);
  });
  it('does not loop even if session storage is blocked',()=>{
    const page=browser();page.sessionStorage.setItem=()=>{throw new Error('Blocked');};
    expect(recoverChunkNavigationError('Importing a module script failed','/cotizaciones/nueva',page)).toBe(true);
    page.location.href='https://trovio.test/cotizaciones/nueva?_actualizar=1';
    expect(recoverChunkNavigationError('Importing a module script failed','/cotizaciones/nueva',page)).toBe(false);
  });
  it('does not reload for API errors, an offline browser or a foreign destination',()=>{
    const page=browser();expect(recoverChunkNavigationError(new Error('API failed'),'/cotizaciones',page)).toBe(false);
    page.navigator.onLine=false;expect(recoverChunkNavigationError('Failed to fetch dynamically imported module','/cotizaciones',page)).toBe(false);
    page.navigator.onLine=true;expect(recoverChunkNavigationError('Failed to fetch dynamically imported module','https://other.test/',page)).toBe(false);
    expect(page.location.replace).not.toHaveBeenCalled();
  });
});
