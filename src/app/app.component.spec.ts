import { vi, type Mock, type Mocked } from 'vitest';
import { Component, signal } from '@angular/core';
import { DataModeService } from './core/services/data-mode.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth.service';

@Component({standalone:true,template:'<h1>Catálogo listo</h1>'})
class ReadyPage {}

describe('AppComponent', () => {
  const sessionExpired = signal(false);
  beforeEach(async () => {
    sessionExpired.set(false);
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: DataModeService, useValue: { mode: signal('real') } },
        { provide: AuthService, useValue: { currentUser: () => null, isLoggedIn: () => false, sessionExpired } }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('redirects an expired idle session to login with an explanation', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    sessionExpired.set(true);
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'inactivity' } });
  });
});

it('shows a startup screen instead of an isolated footer until the first guarded page is ready',async()=>{
 let finish!:()=>void;const pending=new Promise<boolean>(resolve=>finish=()=>resolve(true));
 await TestBed.configureTestingModule({imports:[AppComponent],providers:[provideRouter([{path:'ready',component:ReadyPage,canActivate:[()=>pending]}]),
  {provide:DataModeService,useValue:{mode:signal('real')}},
  {provide:AuthService,useValue:{currentUser:()=>null,isLoggedIn:()=>false,sessionExpired:signal(false)}}]}).compileComponents();
 const fixture=TestBed.createComponent(AppComponent);fixture.detectChanges();
 const navigation=TestBed.inject(Router).navigateByUrl('/ready');
 expect(fixture.nativeElement.querySelector('.startup-loading')?.textContent).toContain('Cargando Trovio');
 expect(fixture.nativeElement.querySelector('app-site-footer')).toBeNull();
 finish();await navigation;fixture.detectChanges();
 expect(fixture.nativeElement.querySelector('.startup-loading')).toBeNull();
 expect(fixture.nativeElement.querySelector('app-site-footer')).not.toBeNull();
 expect(fixture.nativeElement.querySelector('.app-content').hidden).toBe(false);
 fixture.destroy();
});
