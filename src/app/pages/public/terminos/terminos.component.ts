import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_IDENTITY } from '../../../core/config/legal-identity.config';

@Component({
  selector: 'app-terminos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terminos.component.html',
  styleUrl: './terminos.component.scss'
})
export class TerminosComponent {
  protected readonly legalIdentity = LEGAL_IDENTITY;
}
