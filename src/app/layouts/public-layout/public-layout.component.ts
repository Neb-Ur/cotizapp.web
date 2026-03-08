import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteNavbarComponent } from '../../shared/components/site-navbar/site-navbar.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, SiteNavbarComponent],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent {}
