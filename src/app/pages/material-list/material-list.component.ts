import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MaterialListService } from '../../core/services/material-list.service';
import { AuthService } from '../../core/services/auth.service';
import { QuotationStepsComponent } from '../../shared/components/quotation-steps/quotation-steps.component';
@Component({
  standalone: true, imports: [UiLoaderComponent, CommonModule, FormsModule, RouterLink, QuotationStepsComponent],
  templateUrl: './material-list.component.html', styleUrl: './material-list.component.scss'
})
export class MaterialListComponent {
  protected readonly list = inject(MaterialListService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected get total(): number { return this.list.items().reduce((sum, item) => sum + item.quantity * item.unitPrice, 0); }
  protected get canSave(): boolean { return !this.auth.currentUser() || this.auth.currentUser()?.role === 'maestro'; }
  protected get loggedIn(): boolean { return !!this.auth.currentUser(); }
  protected currency(value: number): string { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value); }
  protected continue(existingAccount = false): void {
    if (!this.list.items().length || !this.canSave) return;
    const returnUrl = '/dashboard/maestro/cotizaciones/nuevo?usarLista=1';
    if (this.loggedIn) void this.router.navigateByUrl(returnUrl);
    else void this.router.navigate([existingAccount ? '/login' : '/registro'], { queryParams: { returnUrl } });
  }
}
