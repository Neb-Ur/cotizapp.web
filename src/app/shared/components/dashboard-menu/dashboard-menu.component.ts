import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface DashboardMenuSection {
  id: string;
  label: string;
}

@Component({
  selector: 'app-dashboard-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-menu.component.html',
  styleUrl: './dashboard-menu.component.scss'
})
export class DashboardMenuComponent {
  @Input({ required: true }) title = '';
  @Input() userName = '';
  @Input() sections: ReadonlyArray<DashboardMenuSection> = [];
  @Input() activeSection = '';
  @Input() isMobileViewport = false;
  @Input() isMobileOpen = false;
  @Input() extraActionLabel = '';
  @Input() extraActionClass = '';

  @Output() sectionSelected = new EventEmitter<string>();
  @Output() menuClosed = new EventEmitter<void>();
  @Output() logoutRequested = new EventEmitter<void>();
  @Output() extraActionRequested = new EventEmitter<void>();

  protected selectSection(sectionId: string): void {
    this.sectionSelected.emit(sectionId);
  }

  protected closeMenu(): void {
    this.menuClosed.emit();
  }

  protected logout(): void {
    this.logoutRequested.emit();
  }

  protected triggerExtraAction(): void {
    this.extraActionRequested.emit();
  }
}
