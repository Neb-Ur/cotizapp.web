import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_IDENTITY } from '../../../core/config/legal-identity.config';

@Component({
  selector: 'app-privacidad',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacidad.component.html',
  styleUrl: './privacidad.component.scss'
})
export class PrivacidadComponent {
  protected readonly legalIdentity = LEGAL_IDENTITY;
}
