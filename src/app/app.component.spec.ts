import { vi, type Mock, type Mocked } from 'vitest';
import { signal } from '@angular/core';
import { DataModeService } from './core/services/data-mode.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth.service';

describe('AppComponent', () => {
  const sessionExpired = signal(false);
  beforeEach(async () => {
    sessionExpired.set(false);
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: DataModeService, useValue: { mode: signal('real') } },
        { provide: AuthService, useValue: { currentUser: () => null, sessionExpired } }
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
