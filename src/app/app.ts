import { Component, signal, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { ConfigBuilderComponent } from './components/config-builder/config-builder';
import { ClientManagementComponent } from './components/client-management/client-management';
import { ProcessMonitorComponent } from './components/process-monitor/process-monitor';
import { SavedConfigsComponent } from './components/saved-configs/saved-configs';
import { LoginComponent } from './components/login/login';
import { AuthService } from './services/auth.service';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, MatSidenavModule, MatToolbarModule, MatIconModule, MatListModule,
    MatButtonModule, MatMenuModule, MatBadgeModule, MatTooltipModule, MatDividerModule,
    ConfigBuilderComponent, ClientManagementComponent, ProcessMonitorComponent, SavedConfigsComponent,
    LoginComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected currentView = signal<string>('config-builder');
  protected sidenavOpened = signal<boolean>(true);
  protected isAuthenticated: Signal<boolean>;
  protected userName: Signal<string>;

  constructor(private authService: AuthService) {
    this.isAuthenticated = this.authService.isAuthenticated;
    this.userName = computed(() => this.authService.currentUser() || 'Usuario');
    console.log('App initialized, isAuthenticated:', this.isAuthenticated());
  }

  protected menuItems: MenuItem[] = [
    { id: 'config-builder', label: 'Constructor', icon: 'build', badge: 0 },
    { id: 'saved-configs', label: 'Configuraciones', icon: 'bookmark', badge: 0 },
    { id: 'client-management', label: 'Clientes', icon: 'business', badge: 0 },
    { id: 'process-monitor', label: 'Monitor', icon: 'monitor_heart', badge: 0 }
  ];

  navigateTo(viewId: string): void {
    this.currentView.set(viewId);
  }

  toggleSidenav(): void {
    this.sidenavOpened.update(val => !val);
  }

  onLogout(): void {
    this.authService.logout();
  }
}
