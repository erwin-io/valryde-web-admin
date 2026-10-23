import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import {
  DirectoryPagination,
  DirectoryQuery,
  DriverEntry,
  OperatorEntry,
} from './directory.models';

@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  operators(query: DirectoryQuery) {
    const { q, status, page, pageSize } = query;
    return this.http
      .get<{ operators: OperatorEntry[]; pagination: DirectoryPagination }>(
        `${this.api}/operators`,
        { params: this.params({ q, status, page, pageSize }) },
      )
      .pipe(map(({ operators, pagination }) => ({ entries: operators, pagination })));
  }

  drivers(query: DirectoryQuery) {
    return this.http
      .get<{ drivers: DriverEntry[]; pagination: DirectoryPagination }>(`${this.api}/drivers`, {
        params: this.params(query),
      })
      .pipe(map(({ drivers, pagination }) => ({ entries: drivers, pagination })));
  }

  private params(query: DirectoryQuery): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return params;
  }
}
