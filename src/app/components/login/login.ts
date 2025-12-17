import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  username = '';
  password = '';
  hidePassword = signal(true);
  isLoading = signal(false);
  errorMessage = signal('');

  constructor(
    private authService: AuthService
  ) {
    console.log('LoginComponent initialized');
  }

  onSubmit(): void {
    console.log('onSubmit called!', { username: this.username, password: this.password });

    if (!this.username.trim() || !this.password.trim()) {
      console.log('Validation failed - empty fields');
      this.errorMessage.set('Por favor ingresa usuario y contraseña');
      return;
    }

    console.log('Starting login request...');
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        console.log('Setting isLoading to false...');
        this.isLoading.set(false);
        console.log('isLoading is now:', this.isLoading());
        if (!response.error) {
          // El cambio de estado de autenticación hará que el componente App
          // automáticamente cambie de la vista de login al dashboard
          console.log('Login exitoso');
          console.log('isAuthenticated from AuthService:', this.authService.isAuthenticated());
        } else {
          this.errorMessage.set(response.mensaje || 'Error al iniciar sesión');
        }
      },
      error: (error) => {
        this.isLoading.set(false);

        // Si el error tiene una respuesta de la API, mostrar ese mensaje
        if (error.error && error.error.mensaje) {
          this.errorMessage.set(error.error.mensaje);
        } else if (error.status === 0) {
          // Error de conexión (servidor no disponible)
          this.errorMessage.set('Error de conexión. Verifica que el servidor esté disponible.');
        } else if (error.status === 401) {
          // No autorizado
          this.errorMessage.set('Credenciales inválidas');
        } else if (error.status >= 500) {
          // Error del servidor
          this.errorMessage.set('Error del servidor. Por favor intenta más tarde.');
        } else {
          // Otro error
          this.errorMessage.set(error.message || 'Error al iniciar sesión');
        }

        console.error('Login error:', error);
      }
    });
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update(val => !val);
  }
}
