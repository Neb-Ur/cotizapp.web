import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import {vi} from 'vitest';
import {Router} from '@angular/router';
import {AuthService} from '../../../core/services/auth.service';
import {WorkspaceNavigationService} from '../../../core/services/workspace-navigation.service';
import {WorkspaceShellComponent} from './workspace-shell.component';

it('preserves authentication until pending draft guards allow leaving the workspace',async()=>{
 const auth={logout:vi.fn(async()=>{})},router={events:new Subject(),navigateByUrl:vi.fn(async()=>false)};
 TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:auth},{provide:Router,useValue:router},{provide:WorkspaceNavigationService,useValue:{}}]});
 const shell=TestBed.runInInjectionContext(()=>new WorkspaceShellComponent()) as any;
 await shell.logout();expect(auth.logout).not.toHaveBeenCalled();
 router.navigateByUrl.mockResolvedValue(true);await shell.logout();expect(auth.logout).toHaveBeenCalledOnce();
 TestBed.resetTestingModule();
});
