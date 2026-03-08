import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-toast.component.html',
  styleUrl: './ui-toast.component.scss'
})
export class UiToastComponent {
  @Input() message = '';
  @Input() variant: 'success' | 'error' | 'info' = 'info';
}
