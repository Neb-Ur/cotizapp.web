import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  protected readonly testimonials = [
    {
      author: 'Ruben M.',
      role: 'Maestro independiente',
      quote: 'Antes perdia horas comparando precios. Ahora cierro presupuestos con datos claros en minutos.'
    },
    {
      author: 'Ferreteria El Pilar',
      role: 'Tienda local',
      quote: 'Subimos catalogo una vez y recibimos mas consultas de clientes de la zona.'
    },
    {
      author: 'Carolina T.',
      role: 'Contratista',
      quote: 'El optimizador me muestra exactamente donde comprar para no pasarme del presupuesto.'
    }
  ];
}
