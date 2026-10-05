import { Component } from '@angular/core';
import { STORE_ACCESS_WHATSAPP_URL } from '../../../core/config/legal-identity.config';

@Component({
  selector: 'app-ferreterias',
  standalone: true,
  imports: [],
  templateUrl: './ferreterias.component.html',
  styleUrl: './ferreterias.component.scss'
})
export class FerreteriasComponent {
  protected readonly storeAccessWhatsappUrl = STORE_ACCESS_WHATSAPP_URL;
}
