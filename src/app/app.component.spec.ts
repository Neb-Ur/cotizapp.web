import { vi, type Mock, type Mocked } from 'vitest';
import { signal } from '@angular/core';
import { DataModeService } from './core/services/data-mode.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: DataModeService, useValue: { mode: signal('real') } },
        { provide: AuthService, useValue: { currentUser: () => null } }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
