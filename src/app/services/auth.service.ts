import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';

export interface LoginRequest {
  name: string;
  password: string;
}

export interface LoginResponse {
  error: boolean;
  mensaje: string;
  datosRespuesta: any[];
  codigo: string;
  datos: Array<{
    tokenType: string;
    accessToken: string;
    expires: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5199';
  private tokenSignal = signal<string | null>(null);
  private tokenExpirySignal = signal<Date | null>(null);
  private currentUserSignal = signal<string | null>(null);
  private isAuthenticatedSignal = signal<boolean>(false);

  isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  currentUser = this.currentUserSignal.asReadonly();

  constructor(private http: HttpClient) {
    // TEMPORAL: Login deshabilitado para pruebas - acceso directo
    // this.isAuthenticatedSignal.set(true);
    // this.currentUserSignal.set('Usuario de Prueba');
    // console.log('AUTH: Login deshabilitado - acceso directo habilitado');
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const savedToken = localStorage.getItem('auth_token');
    const savedExpiry = localStorage.getItem('auth_token_expiry');
    const savedUser = localStorage.getItem('auth_user');

    if (savedToken && savedExpiry && savedUser) {
      const expiryDate = new Date(savedExpiry);
      if (expiryDate > new Date()) {
        this.tokenSignal.set(savedToken);
        this.tokenExpirySignal.set(expiryDate);
        this.currentUserSignal.set(savedUser);
        this.isAuthenticatedSignal.set(true);
      } else {
        this.clearAuth();
      }
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    const request: LoginRequest = {
      name: username,
      password: password
    };

    console.log('AuthService: Sending login request to:', `${this.apiUrl}/login`);
    console.log('AuthService: Request body:', request);

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => {
        console.log('AuthService: Received response:', response);
        if (!response.error && response.datos && response.datos.length > 0) {
          const tokenData = response.datos[0];
          this.tokenSignal.set(tokenData.accessToken);

          // Calcular fecha de expiración
          const expiryDate = new Date();
          expiryDate.setHours(expiryDate.getHours() + tokenData.expires);
          this.tokenExpirySignal.set(expiryDate);

          // Guardar usuario
          this.currentUserSignal.set(username);
          this.isAuthenticatedSignal.set(true);

          // Guardar en localStorage
          localStorage.setItem('auth_token', tokenData.accessToken);
          localStorage.setItem('auth_token_expiry', expiryDate.toISOString());
          localStorage.setItem('auth_user', username);
        }
      }),
      catchError(error => {
        console.error('AuthService: Login error:', error);
        console.error('AuthService: Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    this.clearAuth();
  }

  private clearAuth(): void {
    this.tokenSignal.set(null);
    this.tokenExpirySignal.set(null);
    this.currentUserSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token_expiry');
    localStorage.removeItem('auth_user');
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  isTokenValid(): boolean {
    const token = this.tokenSignal();
    const expiry = this.tokenExpirySignal();

    if (!token || !expiry) {
      return false;
    }

    return expiry > new Date();
  }
}
