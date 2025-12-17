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

export interface ProcessStatus {
  id: string;
  clientName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  message: string;
  timestamp: Date;
  response?: any;
  error?: any;
}

@Injectable({
  providedIn: 'root'
})
export class OrchestratorService {
  private apiUrl = 'http://localhost:5199';
  private token = signal<string | null>(null);
  private tokenExpiry = signal<Date | null>(null);

  // Estado de los procesos
  processes = signal<ProcessStatus[]>([]);

  constructor(private http: HttpClient) {
    // Recuperar token del localStorage si existe
    const savedToken = localStorage.getItem('orchestrator_token');
    const savedExpiry = localStorage.getItem('orchestrator_token_expiry');

    if (savedToken && savedExpiry) {
      const expiryDate = new Date(savedExpiry);
      if (expiryDate > new Date()) {
        this.token.set(savedToken);
        this.tokenExpiry.set(expiryDate);
      } else {
        this.clearToken();
      }
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    console.log('Attempting login for user:', username);
    console.log('API URL:', this.apiUrl);
    console.log('Login request payload:', { name: username, password: password });
    const request: LoginRequest = {
      name: username,
      password: password
    };

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => {
        console.log('OrchestratorService: Received response:', response);
        if (!response.error && response.datos && response.datos.length > 0) {
          const tokenData = response.datos[0];
          this.token.set(tokenData.accessToken);

          // Calcular fecha de expiración
          const expiryDate = new Date();
          expiryDate.setHours(expiryDate.getHours() + tokenData.expires);
          this.tokenExpiry.set(expiryDate);

          // Guardar en localStorage
          localStorage.setItem('orchestrator_token', tokenData.accessToken);
          localStorage.setItem('orchestrator_token_expiry', expiryDate.toISOString());
        }
      }),
      catchError(error => {
        console.error('OrchestratorService: Login error:', error);
        console.error('OrchestratorService: Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message
        });
        return throwError(() => error);
      })
    );
  }

  sendToOrchestrator(config: any): Observable<any> {
    if (!this.isTokenValid()) {
      return throwError(() => new Error('Token inválido o expirado. Por favor, inicie sesión nuevamente.'));
    }

    const processId = this.generateProcessId();
    const clientName = config.client || 'Unknown Client';

    // Agregar proceso a la lista con estado "pending"
    this.addProcess({
      id: processId,
      clientName: clientName,
      status: 'pending',
      message: 'Enviando configuración al orquestador...',
      timestamp: new Date()
    });

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token()}`,
      'Content-Type': 'application/json',
      'accept': '*/*'
    });

    // Actualizar estado a "processing"
    this.updateProcessStatus(processId, 'processing', 'Procesando configuración...');

    return this.http.post(`${this.apiUrl}/orquestador`, config, { headers }).pipe(
      tap(response => {
        this.updateProcessStatus(processId, 'success', 'Configuración enviada exitosamente', response);
      }),
      catchError(error => {
        this.updateProcessStatus(processId, 'error',
          error.error?.mensaje || error.message || 'Error al enviar configuración',
          null,
          error
        );
        return throwError(() => error);
      })
    );
  }

  isTokenValid(): boolean {
    const token = this.token();
    const expiry = this.tokenExpiry();

    if (!token || !expiry) {
      return false;
    }

    return expiry > new Date();
  }

  getToken(): string | null {
    return this.token();
  }

  clearToken(): void {
    this.token.set(null);
    this.tokenExpiry.set(null);
    localStorage.removeItem('orchestrator_token');
    localStorage.removeItem('orchestrator_token_expiry');
  }

  logout(): void {
    this.clearToken();
  }

  private generateProcessId(): string {
    return `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addProcess(process: ProcessStatus): void {
    this.processes.update(processes => [process, ...processes]);
  }

  private updateProcessStatus(
    id: string,
    status: ProcessStatus['status'],
    message: string,
    response?: any,
    error?: any
  ): void {
    this.processes.update(processes =>
      processes.map(p =>
        p.id === id
          ? { ...p, status, message, response, error, timestamp: new Date() }
          : p
      )
    );
  }

  clearProcesses(): void {
    this.processes.set([]);
  }

  removeProcess(id: string): void {
    this.processes.update(processes => processes.filter(p => p.id !== id));
  }
}
