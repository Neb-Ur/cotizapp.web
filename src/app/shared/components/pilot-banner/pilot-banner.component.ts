import { Component, inject, afterNextRender } from '@angular/core';
import { PilotService } from '../../../core/services/pilot.service';
@Component({
  selector:'app-pilot-banner', standalone:true,
  template:`@if (pilot.enabled()) {<aside class="pilot-banner" role="note"><i class="pi pi-info-circle" aria-hidden="true"></i><span><strong>Estamos en etapa de prueba.</strong> Las ferreterías actuales son ficticias. Sus precios y stock son simulados: no venden productos ni tienen locales para visitar.</span><a href="/contacto">Danos tu opinión</a></aside>}`,
  styles:[`:host{display:block}.pilot-banner{display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 24px;background:#fff0df;border-bottom:1px solid #ffd4a3;color:#0f2d4a;font-size:13px;line-height:1.5}.pilot-banner a{flex-shrink:0;color:#964600;font-weight:700;text-decoration:underline}@media(max-width:600px){.pilot-banner{align-items:flex-start;flex-wrap:wrap;padding:10px 16px;font-size:12px}.pilot-banner span{flex:1}.pilot-banner a{margin-left:25px}}`]
})
export class PilotBannerComponent {
  protected readonly pilot=inject(PilotService);
  constructor(){afterNextRender(()=>this.pilot.initialize());}
}
