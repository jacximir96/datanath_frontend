import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of, catchError, map, switchMap } from 'rxjs';
import {
  ColumnInfo,
  RelationInfo,
  GraphQLResponse,
  LoginResponse,
  GetTablesResponse,
  GetTableColumnsResponse,
  GetTableRelationsResponse
} from '../models/metadata.model';
import { Origin } from '../models/config.model';

@Injectable({
  providedIn: 'root'
})
export class MetadataService {
  private apiUrl = 'http://localhost:5223/graphql';
  private tokenSignal = signal<string | null>(null);
  private tokenExpirySignal = signal<Date | null>(null);

  constructor(private http: HttpClient) {
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage(): void {
    const savedToken = localStorage.getItem('metadata_token');
    const savedExpiry = localStorage.getItem('metadata_token_expiry');

    if (savedToken && savedExpiry) {
      const expiryDate = new Date(savedExpiry);
      if (expiryDate > new Date()) {
        this.tokenSignal.set(savedToken);
        this.tokenExpirySignal.set(expiryDate);
      } else {
        this.clearToken();
      }
    }
  }

  private saveTokenToStorage(token: string, expiryMinutes: number = 60): void {
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);

    this.tokenSignal.set(token);
    this.tokenExpirySignal.set(expiryDate);

    localStorage.setItem('metadata_token', token);
    localStorage.setItem('metadata_token_expiry', expiryDate.toISOString());
  }

  private clearToken(): void {
    this.tokenSignal.set(null);
    this.tokenExpirySignal.set(null);
    localStorage.removeItem('metadata_token');
    localStorage.removeItem('metadata_token_expiry');
  }

  private isTokenValid(): boolean {
    const token = this.tokenSignal();
    const expiry = this.tokenExpirySignal();

    if (!token || !expiry) {
      return false;
    }

    return expiry > new Date();
  }

  public getHeaders(): HttpHeaders {
    const token = this.tokenSignal();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  login(username: string, password: string): Observable<boolean> {
    const query = `
      mutation {
        login(username: "${username}", password: "${password}") {
          success
          message
          token
        }
      }
    `;

    return this.http.post<GraphQLResponse<LoginResponse>>(
      this.apiUrl,
      { query },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    ).pipe(
      map(response => {
        if (response.errors) {
          throw new Error(response.errors[0].message);
        }

        const loginData = response.data.login;
        if (loginData.success && loginData.token) {
          this.saveTokenToStorage(loginData.token);
          return true;
        }

        throw new Error(loginData.message || 'Login failed');
      }),
      catchError(error => {
        console.error('Metadata API login error:', error);
        return throwError(() => error);
      })
    );
  }

  public ensureAuthenticated(): Observable<boolean> {
    if (this.isTokenValid()) {
      return of(true);
    }

    // Auto-login con credenciales por defecto
    return this.login('usr_orquestador', 'usr_orquestador');
  }

  getTables(origin: Origin): Observable<string[]> {
    // Usar modo de credenciales directas (Modo 2)
    const query = `
      query {
        getTablesFromConnection(connection: {
          servidor: "${origin.servidor}"
          puerto: "${origin.puerto}"
          user: "${origin.user}"
          password: "${origin.password}"
          repository: "${origin.repository}"
          adapter: "${origin.adapter}"
        })
      }
    `;

    return this.ensureAuthenticated().pipe(
      catchError(() => of(true)),
      switchMap(() => this.http.post<GraphQLResponse<{ getTablesFromConnection: string[] }>>(
        this.apiUrl,
        { query },
        { headers: this.getHeaders() }
      )),
      map(response => {
        if (response.errors) {
          console.error('GraphQL errors:', response.errors);
          return [];
        }
        return response.data.getTablesFromConnection || [];
      }),
      catchError(error => {
        console.error('Error fetching tables:', error);
        return of([]);
      })
    );
  }

  getTableColumns(origin: Origin, tableName: string): Observable<ColumnInfo[]> {
    // Usar modo de credenciales directas (Modo 2)
    const query = `
      query {
        getTableColumnsFromConnection(
          connection: {
            servidor: "${origin.servidor}"
            puerto: "${origin.puerto}"
            user: "${origin.user}"
            password: "${origin.password}"
            repository: "${origin.repository}"
            adapter: "${origin.adapter}"
          }
          tableName: "${tableName}"
        ) {
          columnName
          dataType
          maxLength
          isNullable
          isPrimaryKey
          defaultValue
        }
      }
    `;

    return this.ensureAuthenticated().pipe(
      catchError(() => of(true)),
      switchMap(() => this.http.post<GraphQLResponse<{ getTableColumnsFromConnection: ColumnInfo[] }>>(
        this.apiUrl,
        { query },
        { headers: this.getHeaders() }
      )),
      map(response => {
        if (response.errors) {
          console.error('GraphQL errors:', response.errors);
          return [];
        }
        return response.data.getTableColumnsFromConnection || [];
      }),
      catchError(error => {
        console.error('Error fetching columns:', error);
        return of([]);
      })
    );
  }

    getTableRelations(origin: Origin, tableName: string): Observable<RelationInfo[]> {
      // Usar modo de credenciales directas (Modo 2)
      const query = `
        query {
          getTableRelationsFromConnection(
            connection: {
              servidor: "${origin.servidor}"
              puerto: "${origin.puerto}"
              user: "${origin.user}"
              password: "${origin.password}"
              repository: "${origin.repository}"
              adapter: "${origin.adapter}"
            }
            tableName: "${tableName}"
          ) {
            relationName
            fromTable
            fromColumn
            toTable
            toColumn
            relationType
          }
        }
      `;
  
      return this.ensureAuthenticated().pipe(
        catchError(() => of(true)),
        switchMap(() => this.http.post<GraphQLResponse<{ getTableRelationsFromConnection: RelationInfo[] }>>(
          this.apiUrl,
          { query },
          { headers: this.getHeaders() }
        )),
        map(response => {
          if (response.errors) {
            console.error('GraphQL errors:', response.errors);
            return [];
          }
          return response.data.getTableRelationsFromConnection || [];
        }),
        catchError(error => {
          console.error('Error fetching relations:', error);
          return of([]);
        })
      );
    }
  }
