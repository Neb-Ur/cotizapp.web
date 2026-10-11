import {isPlatformBrowser} from '@angular/common';
import {effect,inject,Injectable,PLATFORM_ID,signal} from '@angular/core';
import {NavigationEnd,Router} from '@angular/router';
import {CookieConsentService} from './cookie-consent.service';
import {ApiClientService} from './api-client.service';
@Injectable({providedIn:'root'})
export class VisitAnalyticsService {
  private readonly consent=inject(CookieConsentService);
  private readonly api=inject(ApiClientService);
  private readonly router=inject(Router);
  private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));
  private readonly path=signal(this.router.navigated ? this.router.url : '');
  private lastVisit='';
  private pending=false;
  constructor(){
    this.router.events.subscribe(event=>{if(event instanceof NavigationEnd)this.path.set(event.urlAfterRedirects);});
    effect(()=>{
      const allowed=this.consent.analyticsAllowed(),path=this.path();
      if(this.browser&&allowed&&path&& !/^\/(dashboard|cuenta|auth|login|registro)(\/|\?|$)/.test(path))void this.record();
    });
  }
  private async record():Promise<void>{
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const visit=day+'|'+this.path();
    if(this.lastVisit===visit||this.pending)return;
    this.pending=true;
    try{await this.api.post('/analytics/visit',{analyticsConsent:true,consentVersion:3},false);this.lastVisit=visit;}
    catch{/* Optional analytics must never block navigation. */}
    finally{this.pending=false;}
  }
}
