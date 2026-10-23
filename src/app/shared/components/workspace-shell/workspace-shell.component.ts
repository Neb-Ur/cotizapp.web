import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { WorkspaceNavigationService } from '../../../core/services/workspace-navigation.service';
import { BrandMarkComponent } from '../brand-mark/brand-mark.component';
import { ModalSurfaceDirective } from '../../directives/modal-surface.directive';

@Component({selector:'app-workspace-shell',standalone:true,imports:[RouterLink,BrandMarkComponent,ModalSurfaceDirective],templateUrl:'./workspace-shell.component.html',styleUrl:'./workspace-shell.component.scss'})
export class WorkspaceShellComponent {
  protected readonly navigation=inject(WorkspaceNavigationService);
  protected readonly auth=inject(AuthService);
  private readonly router=inject(Router);
  protected readonly menuOpen=signal(false);
  protected readonly mobile=signal(typeof window!=='undefined' && window.innerWidth<=960);
  constructor(){inject(Router).events.pipe(takeUntilDestroyed()).subscribe(event=>{if(event instanceof NavigationEnd)this.menuOpen.set(false);});}
  @HostListener('window:resize') resize(){this.mobile.set(window.innerWidth<=960);if(!this.mobile())this.menuOpen.set(false);}
  protected async logout(){this.menuOpen.set(false);if(await this.router.navigateByUrl('/'))await this.auth.logout();}
}
