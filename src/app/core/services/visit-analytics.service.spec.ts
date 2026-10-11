import {TestBed} from '@angular/core/testing';
import {PLATFORM_ID,signal} from '@angular/core';
import {NavigationEnd,Router} from '@angular/router';
import {Subject,of} from 'rxjs';
import {vi} from 'vitest';
import {VisitAnalyticsService} from './visit-analytics.service';
import {CookieConsentService} from './cookie-consent.service';
import {HttpClient} from '@angular/common/http';
import {VISIT_ANALYTICS_URL} from '../config/api.config';
describe('consented visits',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 function setup(platform='browser'){
  const analyticsAllowed=signal(false),events=new Subject<any>();const post=vi.fn(()=>of({data:{recorded:true}}));
  TestBed.configureTestingModule({providers:[{provide:PLATFORM_ID,useValue:platform},{provide:CookieConsentService,useValue:{analyticsAllowed}},{provide:HttpClient,useValue:{post}},{provide:Router,useValue:{url:'/',navigated:false,events}}]});
  TestBed.inject(VisitAnalyticsService);TestBed.flushEffects();return {analyticsAllowed,events,post};
 }
 it('waits for consent and completed navigation, then ignores dashboard navigation',async()=>{
  const {analyticsAllowed,events,post}=setup();analyticsAllowed.set(true);TestBed.flushEffects();expect(post).not.toHaveBeenCalled();
  events.next(new NavigationEnd(1,'/dashboard/admin','/dashboard/admin'));TestBed.flushEffects();expect(post).not.toHaveBeenCalled();
  events.next(new NavigationEnd(2,'/buscar','/buscar'));TestBed.flushEffects();await Promise.resolve();expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0]).toEqual([VISIT_ANALYTICS_URL,{analyticsConsent:true,consentVersion:3}]);
  analyticsAllowed.set(false);events.next(new NavigationEnd(3,'/','/'));TestBed.flushEffects();expect(post).toHaveBeenCalledTimes(1);
 });
 it('does not record SSR visits or navigation without consent',()=>{
  const {analyticsAllowed,events,post}=setup('server');analyticsAllowed.set(true);events.next(new NavigationEnd(1,'/','/'));TestBed.flushEffects();expect(post).not.toHaveBeenCalled();
 });
});
