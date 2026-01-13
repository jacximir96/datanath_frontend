import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { MetadataService } from './metadata.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GraphqlService {
  private graphqlEndpoint = environment.graphqlUrl;
  private metadataService = inject(MetadataService);

  constructor(private http: HttpClient) { }

  getPersistentRequirementById(id: string): Observable<any> {
    const query = `
      query {
        getPersistentRequirementById(id: "${id}") {
          id
          data
          rid
          self
          eTag
          attachments
          timestamp
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(this.graphqlEndpoint, { query }, { headers });
      })
    );
  }

  getConnections(clientName: string, skip: number = 0, take: number = 10, clientIdFilter?: string): Observable<any> {
    const clientIdParam = clientIdFilter ? `, clientId: "${clientIdFilter}"` : '';
    const query = `
      query {
        getConnections(clientName: "${clientName}", skip: ${skip}, take: ${take}${clientIdParam}) {
          items {
            id
            clientName
            repository
            adapter
            clientId
          }
          totalCount
          skip
          take
          pageCount
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(this.graphqlEndpoint, { query }, { headers });
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SAVED CONFIGURATIONS
  // ═══════════════════════════════════════════════════════════════

  getSavedConfigurations(): Observable<any> {
    const query = `
      query {
        getSavedConfigurations {
          id
          name
          description
          config
          scenarios {
            id
            name
            isReadOnly
            assignments
            storeFilter
          }
          createdAt
          lastUsed
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(this.graphqlEndpoint, { query }, { headers });
      })
    );
  }

  getSavedConfigurationById(id: string): Observable<any> {
    const query = `
      query {
        getSavedConfigurationById(id: "${id}") {
          id
          name
          description
          config
          scenarios {
            id
            name
            isReadOnly
            assignments
            storeFilter
          }
          createdAt
          lastUsed
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(this.graphqlEndpoint, { query }, { headers });
      })
    );
  }

  saveSavedConfiguration(input: any): Observable<any> {
    const mutation = `
      mutation($input: SavedConfigurationInput!) {
        saveSavedConfiguration(input: $input) {
          id
          name
          description
          config
          scenarios {
            id
            name
            isReadOnly
            assignments
            storeFilter
          }
          createdAt
          lastUsed
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { input } },
          { headers }
        );
      })
    );
  }

  updateSavedConfiguration(id: string, input: any): Observable<any> {
    const mutation = `
      mutation($id: String!, $input: SavedConfigurationInput!) {
        updateSavedConfiguration(id: $id, input: $input) {
          id
          name
          description
          config
          scenarios {
            id
            name
            isReadOnly
            assignments
            storeFilter
          }
          createdAt
          lastUsed
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { id, input } },
          { headers }
        );
      })
    );
  }

  deleteSavedConfiguration(id: string): Observable<any> {
    const mutation = `
      mutation($id: String!) {
        deleteSavedConfiguration(id: $id)
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { id } },
          { headers }
        );
      })
    );
  }

  updateLastUsed(id: string): Observable<any> {
    const mutation = `
      mutation($id: String!) {
        updateLastUsed(id: $id) {
          id
          lastUsed
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { id } },
          { headers }
        );
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CONNECTIONS (for Client Configuration Management)
  // ═══════════════════════════════════════════════════════════════

  getAllConnections(): Observable<any> {
    const query = `
      query {
        getConnections(clientName: "", skip: 0, take: 1000) {
          items {
            id
            clientConfigId
            clientId
            clientName
            servidor
            puerto
            user
            password
            repository
            adapter
            associatedStores
            storeFilterField
          }
          totalCount
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(this.graphqlEndpoint, { query }, { headers });
      })
    );
  }

  createConnection(input: any): Observable<any> {
    const mutation = `
      mutation CreateConnection($input: ConnectionInput!) {
        createConnection(input: $input) {
          id
          clientConfigId
          clientName
          clientId
          servidor
          puerto
          user
          password
          repository
          adapter
          associatedStores
          storeFilterField
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { input } },
          { headers }
        );
      })
    );
  }

  updateConnection(id: string, input: any): Observable<any> {
    const mutation = `
      mutation($id: String!, $input: ConnectionInput!) {
        updateConnection(id: $id, input: $input) {
          id
          clientConfigId
          clientId
          clientName
          servidor
          puerto
          user
          password
          repository
          adapter
          associatedStores
          storeFilterField
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { id, input } },
          { headers }
        );
      })
    );
  }

  deleteConnection(id: string): Observable<any> {
    const mutation = `
      mutation($id: String!) {
        deleteConnection(id: $id)
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { id } },
          { headers }
        );
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CLIENT CONFIG
  // ═══════════════════════════════════════════════════════════════

  getClientConfigs(): Observable<any> {
    const query = `
      query {
        getClientConfigs {
          id
          name
          description
          structureType
          createdAt
          updatedAt
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(this.graphqlEndpoint, { query }, { headers });
      })
    );
  }

  getClientConfigById(id: string): Observable<any> {
    const query = `
      query($id: String!) {
        getClientConfigById(id: $id) {
          id
          name
          description
          structureType
          createdAt
          updatedAt
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query, variables: { id } },
          { headers }
        );
      })
    );
  }

  createClientConfig(input: any): Observable<any> {
    const mutation = `
      mutation CreateClientConfig($input: ClientConfigInput!) {
        createClientConfig(input: $input) {
          id
          name
          description
          structureType
          createdAt
          updatedAt
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { input } },
          { headers }
        );
      })
    );
  }

  updateClientConfig(id: string, input: any): Observable<any> {
    const mutation = `
      mutation($id: String!, $input: ClientConfigInput!) {
        updateClientConfig(id: $id, input: $input) {
          id
          name
          description
          structureType
          createdAt
          updatedAt
        }
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { id, input } },
          { headers }
        );
      })
    );
  }

  deleteClientConfig(id: string): Observable<any> {
    const mutation = `
      mutation($id: String!) {
        deleteClientConfig(id: $id)
      }
    `;

    return this.metadataService.ensureAuthenticated().pipe(
      switchMap(() => {
        const headers = this.metadataService.getHeaders();
        return this.http.post<any>(
          this.graphqlEndpoint,
          { query: mutation, variables: { id } },
          { headers }
        );
      })
    );
  }
}