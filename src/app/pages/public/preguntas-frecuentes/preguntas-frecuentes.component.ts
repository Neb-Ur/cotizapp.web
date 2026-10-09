import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-preguntas-frecuentes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './preguntas-frecuentes.component.html',
  styleUrl: './preguntas-frecuentes.component.scss'
})
export class PreguntasFrecuentesComponent {
  protected readonly faqItems = [
    { question: '¿Puedo comprar o reservar productos aquí?', answer: 'No. Trovio compara precios y genera cotizaciones. Guardar o compartir una cotización no constituye una compra, un pedido ni una reserva; compras directamente en la ferretería.' },
    {
      question: 'Como funciona Trovio para maestros?',
      answer: 'Permite comparar precios entre ferreterias, crear cotizaciones y organizar compras por proyecto.'
    },
    {
      question: 'Como agrega productos una ferreteria?',
      answer: 'Primero busca en el catalogo maestro y vincula el producto cargando precio y stock. Si no existe, puede crear uno nuevo.'
    },
    {
      question: 'Que pasa si cambia el stock despues de una cotizacion?',
      answer: 'La cotizacion es referencial. El valor final depende de disponibilidad y condiciones comerciales al momento de compra.'
    },
    {
      question: 'Puedo exportar cotizaciones?',
      answer: 'Si, las cotizaciones pueden exportarse en formato PDF desde el panel de maestro.'
    },
    {
      question: 'Que planes tienen para maestros y ferreterias?',
      answer: 'Los maestros pueden buscar gratis y guardar hasta dos cotizaciones. Las ferreterías ingresan previa aprobación y aceptación del contrato. Las condiciones comerciales se acuerdan directamente; el piloto no tiene cobros automáticos.'
    },
    {
      question: 'Donde pido soporte?',
      answer: 'Puedes escribir desde la página de contacto. Las solicitudes sobre datos personales pueden enviarse sin iniciar sesión.'
    }
  ];
}
