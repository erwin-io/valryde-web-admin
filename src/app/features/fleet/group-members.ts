import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PageState } from '../../shared/ui/page-state';

type Member = { memberType: 'DRIVER'; driverId: string; displayName: string; status: string; activeJeepneyId: string | null } |
  { memberType: 'JEEPNEY'; jeepneyId: string; plateNo: string; status: string; activeDriverId: string | null };
interface MemberPage { members: Member[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }

/** G2 member projection at API main 810c8a1. No user IDs/emails are inferred from business IDs. */
@Component({
  selector: 'app-group-members',
  imports: [MatButtonModule, MatFormFieldModule, MatPaginatorModule, MatSelectModule, RouterLink, PageState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-label="Fleet group members">
      <h2>Group members</h2>
      <mat-form-field appearance="outline"><mat-label>Member type</mat-label>
        <mat-select [value]="type()" (selectionChange)="filter($event.value)">
          <mat-option value="">Drivers and jeepneys</mat-option><mat-option value="DRIVER">Drivers</mat-option>
          <mat-option value="JEEPNEY">Jeepneys</mat-option>
        </mat-select>
      </mat-form-field>
      @switch (state()) {
        @case ('loading') { <app-page-state kind="loading" title="Loading group members…" /> }
        @case ('denied') { <app-page-state kind="denied" [problem]="problem()" /> }
        @case ('error') { <app-page-state kind="error" title="Members could not be loaded" [problem]="problem()" (retry)="load()" /> }
        @default {
          @if (members().length === 0) { <p>No members on this page.</p> }
          <ul>@for (member of members(); track member.memberType + id(member)) {
            <li>
              <strong>{{ name(member) }}</strong> · {{ member.memberType }} · {{ member.status }}
              <span>Record ID: {{ id(member) }}</span>
              @if (jeepneyId(member); as jid) { <a [routerLink]="['/fleet/jeepneys', jid]">Jeepney record</a> }
              @else { <span>No active jeepney assignment</span> }
            </li>
          }</ul>
          <mat-paginator [length]="total()" [pageIndex]="page() - 1" [pageSize]="pageSize()"
            [pageSizeOptions]="[10,20,50,100]" (page)="paginate($event)" aria-label="Group member pages" />
        }
      }
    </section>
  `,
  styles: `.panel { padding:20px; margin-bottom:20px; border:1px solid var(--vr-border); border-radius:8px; }
    ul { padding-inline-start:20px; } li { margin-block:12px; overflow-wrap:anywhere; } li span, li a { display:block; }`,
})
export class GroupMembers {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly groupId = input.required<string>();
  protected readonly type = signal<'' | 'DRIVER' | 'JEEPNEY'>('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly total = signal(0);
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'denied'>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly members = signal<Member[]>([]);
  constructor() { effect(() => { const id = this.groupId(); untracked(() => { this.page.set(1); this.type.set(''); this.load(id); }); }); }
  protected id(member: Member): string { return member.memberType === 'DRIVER' ? member.driverId : member.jeepneyId; }
  protected name(member: Member): string { return member.memberType === 'DRIVER' ? member.displayName : member.plateNo; }
  protected jeepneyId(member: Member): string | null { return member.memberType === 'DRIVER' ? member.activeJeepneyId : member.jeepneyId; }
  protected filter(type: '' | 'DRIVER' | 'JEEPNEY'): void { this.type.set(type); this.page.set(1); this.load(); }
  protected paginate(event: PageEvent): void { this.page.set(event.pageIndex + 1); this.pageSize.set(event.pageSize); this.load(); }
  protected load(groupId = this.groupId()): void {
    this.request?.unsubscribe(); this.state.set('loading'); this.problem.set(null); this.members.set([]);
    this.request = this.http.get<MemberPage>(`${this.api}/fleet-groups/${encodeURIComponent(groupId)}/members`, {
      params: { page: this.page(), pageSize: this.pageSize(), ...(this.type() ? { memberType: this.type() } : {}) },
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ members, pagination }) => {
        this.members.set(members); this.total.set(pagination.total); this.page.set(pagination.page);
        this.pageSize.set(pagination.pageSize); this.state.set('ready');
      },
      error: (error: unknown) => {
        const p = toApiProblem(error); this.problem.set(p);
        this.state.set(p.status === 403 || p.status === 401 ? 'denied' : 'error');
      },
    });
  }
}
