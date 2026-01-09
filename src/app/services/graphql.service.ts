import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { MetadataService } from './metadata.service';

@Injectable({
  providedIn: 'root'
})
export class GraphqlService {
  private graphqlEndpoint = 'http://localhost:5223/graphql';
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
}