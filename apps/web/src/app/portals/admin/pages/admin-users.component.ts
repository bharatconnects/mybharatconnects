import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Role, User } from '../../../core/models/user.model';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { ToastService } from '../../../core/services/toast.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { PhoneInputComponent } from '../../../shared/components/phone-input/phone-input.component';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, PhoneInputComponent, BbSelectComponent],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">Manage accounts, roles, and access.</p>
      <span class="bb-page-count">{{ users.length }} total</span>
    </div>

    <div class="bb-filter-card mb-4">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="bb-filter-toggle flex-1"
          (click)="filtersExpanded = !filtersExpanded"
          [attr.aria-expanded]="filtersExpanded"
        >
          <span class="flex items-center gap-1.5">
            <i class="material-icons-outlined text-base">tune</i>
            Filters
            @if (activeFilterCount() > 0) {
              <span class="bb-chip bb-chip-info">{{ activeFilterCount() }}</span>
            }
          </span>
          <i class="material-icons-outlined text-base">{{
            filtersExpanded ? 'expand_less' : 'expand_more'
          }}</i>
        </button>
        <button
          class="bb-btn bb-btn-primary gap-1 shrink-0 sm:hidden"
          (click)="openCreate()"
          aria-label="Add user"
        >
          <i class="material-icons-outlined text-base">add</i>
        </button>
      </div>

      <div
        class="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end"
        [class.bb-filter-row--collapsed]="!filtersExpanded"
      >
        <div class="flex-1 min-w-36">
          <label class="bb-label" for="admin-users-role">Role</label>
          <app-bb-select
            id="admin-users-role"
            [(ngModel)]="roleFilter"
            (ngModelChange)="loadUsers()"
            [options]="roleOptions()"
            placeholder="All roles"
          ></app-bb-select>
        </div>
        <div class="flex-1 min-w-36">
          <label class="bb-label" for="admin-users-presence">Availability</label>
          <app-bb-select
            id="admin-users-presence"
            [(ngModel)]="presenceFilter"
            (ngModelChange)="loadUsers()"
            [options]="presenceFilterOptions"
            placeholder="All"
          ></app-bb-select>
        </div>
        <div class="flex-1 min-w-36">
          <label class="bb-label" for="admin-users-sort">Sort by</label>
          <app-bb-select
            id="admin-users-sort"
            [(ngModel)]="sortOrder"
            (ngModelChange)="applySort()"
            ariaLabel="Sort by last update date"
            [options]="sortOrderOptions"
          ></app-bb-select>
        </div>
        <div class="flex-1 min-w-36 hidden sm:block">
          <label class="bb-label">&nbsp;</label>
          <button class="bb-btn bb-btn-primary gap-1 w-full" (click)="openCreate()">
            <i class="material-icons-outlined text-base">add</i> Add User
          </button>
        </div>
      </div>
    </div>

    @if (actionError) {
      <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20">
        <i class="material-icons-outlined text-base">error_outline</i>
        {{ actionError }}
      </div>
    }

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    } @else if (users.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">group</i></div>
          <p class="bb-empty-title">No users found</p>
          <p>No accounts have been created yet.</p>
        </div>
      </div>
    } @else {
      <!-- Desktop table -->
      <div class="hidden md:block bb-table-wrap">
        <div class="overflow-y-auto max-h-[60vh]">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (u of users; track u._id) {
                <tr>
                  <td class="font-medium">{{ u.name }}</td>
                  <td>{{ u.email }}</td>
                  <td>
                    <span class="bb-chip" [ngClass]="roleChipClass(u.role)">{{ u.role }}</span>
                  </td>
                  <td>
                    <i
                      class="material-icons-outlined"
                      [class.text-success]="u.isActive"
                      [class.opacity-30]="!u.isActive"
                      [attr.aria-label]="u.isActive ? 'Active' : 'Inactive'"
                    >
                      {{ u.isActive ? 'check_circle' : 'cancel' }}
                    </i>
                  </td>
                  <td class="whitespace-nowrap">{{ u.createdAt | date: 'd MMM y, h:mm a' }}</td>
                  <td>
                    <div class="flex items-center gap-1">
                      <button
                        class="bb-btn bb-btn-ghost bb-btn-icon"
                        title="Edit"
                        (click)="openEdit(u)"
                      >
                        <i class="material-icons-outlined">edit</i>
                      </button>
                      <button
                        class="bb-btn bb-btn-icon border"
                        [ngClass]="
                          u.isActive
                            ? 'bg-success/15 border-success/40 text-success hover:bg-success/25'
                            : 'bg-error/15 border-error/40 text-error hover:bg-error/25'
                        "
                        [title]="u.isActive ? 'Deactivate user' : 'Activate user'"
                        (click)="toggleActive(u)"
                      >
                        <i class="material-icons-outlined">{{
                          u.isActive ? 'toggle_on' : 'toggle_off'
                        }}</i>
                      </button>
                      <button
                        class="bb-btn bb-btn-ghost bb-btn-icon text-error"
                        title="Delete"
                        (click)="deleteUser(u)"
                      >
                        <i class="material-icons-outlined">delete</i>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile card list -->
      <div class="md:hidden flex flex-col gap-3">
        @for (u of users; track u._id) {
          <div class="bb-row-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ u.name }}</p>
                <p class="text-sm text-base-content/70 truncate">{{ u.email }}</p>
              </div>
              <span class="bb-chip" [ngClass]="roleChipClass(u.role)">{{ u.role }}</span>
            </div>
            <div class="flex items-center justify-between mt-2 text-xs text-base-content/60">
              <span class="inline-flex items-center gap-1">
                <i
                  class="material-icons-outlined text-base"
                  [class.text-success]="u.isActive"
                  [class.opacity-30]="!u.isActive"
                >
                  {{ u.isActive ? 'check_circle' : 'cancel' }}
                </i>
                {{ u.isActive ? 'Active' : 'Inactive' }}
              </span>
              <span>{{ u.createdAt | date: 'd MMM y, h:mm a' }}</span>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="openEdit(u)">
                <i class="material-icons-outlined">edit</i>
                Edit
              </button>
              <button
                class="bb-btn bb-btn-sm border"
                [ngClass]="
                  u.isActive
                    ? 'bg-success/15 border-success/40 text-success hover:bg-success/25'
                    : 'bg-error/15 border-error/40 text-error hover:bg-error/25'
                "
                (click)="toggleActive(u)"
              >
                <i class="material-icons-outlined">{{ u.isActive ? 'toggle_on' : 'toggle_off' }}</i>
                {{ u.isActive ? 'Deactivate' : 'Activate' }}
              </button>
              <button class="bb-btn bb-btn-ghost bb-btn-sm text-error" (click)="deleteUser(u)">
                <i class="material-icons-outlined">delete</i>
                Delete
              </button>
            </div>
          </div>
        }
      </div>
    }

    @if (showDeleteModal) {
      <div class="modal modal-open">
        <div class="modal-box max-w-lg relative">
          <button
            class="absolute top-3 right-3 bb-btn bb-btn-ghost bb-btn-icon"
            type="button"
            (click)="showDeleteModal = false"
          >
            <i class="material-icons-outlined">close</i>
          </button>
          <div class="flex flex-col items-center gap-3 py-2">
            <div class="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
              <i class="material-icons-outlined text-error text-2xl">delete_forever</i>
            </div>
            <h3 class="font-bold text-lg">Delete User</h3>
            <p class="text-sm text-center" style="color:var(--ink-60)">
              Are you sure you want to delete <strong>{{ userToDelete?.email }}</strong
              >? This action cannot be undone.
            </p>
          </div>
          <div class="modal-action">
            <button class="bb-btn bb-btn-ghost" (click)="showDeleteModal = false">Cancel</button>
            <button class="bb-btn bb-btn-danger" [disabled]="saving" (click)="confirmDelete()">
              @if (saving) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                Delete
              }
            </button>
          </div>
        </div>
        <div class="modal-backdrop" (click)="showDeleteModal = false"></div>
      </div>
    }

    @if (showCreateModal) {
      <div class="modal modal-open">
        <div class="modal-box max-w-xl relative">
          <h3 class="font-bold text-lg mb-3">Create User</h3>
          <button
            class="absolute top-3 right-3 bb-btn bb-btn-ghost bb-btn-icon"
            type="button"
            (click)="showCreateModal = false"
          >
            <i class="material-icons-outlined">close</i>
          </button>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              class="bb-input md:col-span-2"
              placeholder="Full name"
              [(ngModel)]="createForm.name"
            />
            <input
              class="bb-input md:col-span-2"
              placeholder="Email"
              [(ngModel)]="createForm.email"
            />
            <div class="relative md:col-span-2">
              <input
                class="bb-input pr-11 w-full"
                placeholder="Password"
                [type]="showPassword ? 'text' : 'password'"
                [(ngModel)]="createForm.password"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content transition-colors"
                (click)="showPassword = !showPassword"
                [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
              >
                <i class="material-icons-outlined text-lg" aria-hidden="true">{{
                  showPassword ? 'visibility_off' : 'visibility'
                }}</i>
              </button>
            </div>
            <app-bb-select [(ngModel)]="createForm.role" [options]="roleSelectOptions()"></app-bb-select>
            <app-bb-select
              [(ngModel)]="createForm.cluster"
              [options]="clusterSelectOptions()"
              placeholder="No Cluster"
            ></app-bb-select>
          </div>
          <div class="modal-action">
            <button class="bb-btn bb-btn-ghost" (click)="showCreateModal = false">Cancel</button>
            <button class="bb-btn bb-btn-primary" [disabled]="saving" (click)="createUser()">
              @if (saving) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                Create
              }
            </button>
          </div>
        </div>
      </div>
    }

    @if (showEditModal) {
      <div class="modal modal-open">
        <div class="modal-box max-w-xl relative">
          <h3 class="font-bold text-lg mb-3">Edit User</h3>
          <button
            class="absolute top-3 right-3 bb-btn bb-btn-ghost bb-btn-icon"
            type="button"
            (click)="showEditModal = false"
          >
            <i class="material-icons-outlined">close</i>
          </button>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              class="bb-input md:col-span-2"
              placeholder="Full name"
              [(ngModel)]="editForm.name"
            />
            <app-phone-input
              class="md:col-span-2"
              placeholder="Phone"
              defaultCountryIso2="IN"
              [(ngModel)]="editForm.phone"
            />
            <app-bb-select [(ngModel)]="editForm.role" [options]="roleSelectOptions()"></app-bb-select>
            <app-bb-select
              [(ngModel)]="editForm.cluster"
              [options]="clusterSelectOptions()"
              placeholder="No Cluster"
            ></app-bb-select>
            <label
              class="label cursor-pointer md:col-span-2 justify-self-start w-fit justify-start gap-2"
            >
              <input type="checkbox" class="checkbox checkbox-sm" [(ngModel)]="editForm.isActive" />
              <span class="label-text">Active</span>
            </label>
          </div>
          <div class="modal-action">
            <button class="bb-btn bb-btn-ghost" (click)="showEditModal = false">Cancel</button>
            <button class="bb-btn bb-btn-primary" [disabled]="saving" (click)="saveEdit()">
              @if (saving) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                Save
              }
            </button>
          </div>
        </div>
      </div>
    }

    @if (!loading && error) {
      <div
        role="alert"
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm mt-4"
      >
        <i class="material-icons-outlined">error</i>
        <span>Failed to load users. Please try again.</span>
      </div>
    }
  `,
  styles: [
    `
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--ivory-soft);
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--ivory-soft);
      }
    `,
  ],
})
export class AdminUsersComponent implements OnInit {
  users: User[] = [];
  sortOrder: DateSortOrder = 'desc';
  loading = true;
  error = false;
  saving = false;
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];
  readonly presenceFilterOptions = [
    { value: '', label: 'All' },
    { value: 'ONLINE', label: 'Online' },
    { value: 'AWAY', label: 'Away' },
  ];
  actionError = '';
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;
  showPassword = false;
  userToDelete: User | null = null;
  selectedUserId = '';
  roleFilter = '';
  presenceFilter = '';
  filtersExpanded = true;

  activeFilterCount(): number {
    return (this.roleFilter ? 1 : 0) + (this.presenceFilter ? 1 : 0);
  }
  roles = Object.values(Role);
  clusters = ['PROPERTY', 'TAX', 'HYBRID'];

  roleOptions(): { value: string; label: string }[] {
    return [{ value: '', label: 'All roles' }, ...this.roles.map((r) => ({ value: r, label: r }))];
  }

  roleSelectOptions(): { value: string; label: string }[] {
    return this.roles.map((r) => ({ value: r, label: r }));
  }

  clusterSelectOptions(): { value: string; label: string }[] {
    return [{ value: '', label: 'No Cluster' }, ...this.clusters.map((c) => ({ value: c, label: c }))];
  }
  createForm: {
    name: string;
    email: string;
    password: string;
    role: Role;
    cluster: string;
  } = {
    name: '',
    email: '',
    password: '',
    role: Role.CLIENT,
    cluster: '',
  };
  editForm: {
    name: string;
    phone: string;
    role: Role;
    cluster: string;
    isActive: boolean;
  } = {
    name: '',
    phone: '',
    role: Role.CLIENT,
    cluster: '',
    isActive: true,
  };

  constructor(
    private api: ApiService,
    private pageTitleService: PageTitleService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Users');
    this.loadUsers();
  }

  applySort(): void {
    this.users = sortByDate(this.users, this.sortOrder);
  }

  loadUsers(): void {
    this.api
      .get<User[]>('/users', {
        role: this.roleFilter || undefined,
        presence: this.presenceFilter || undefined,
      })
      .subscribe({
        next: (data) => {
          this.users = sortByDate(data ?? [], this.sortOrder);
          this.loading = false;
          this.pageTitleService.setBadge(`${this.users.length} total`);
        },
        error: () => {
          this.error = true;
          this.loading = false;
        },
      });
  }

  openCreate(): void {
    this.actionError = '';
    this.createForm = {
      name: '',
      email: '',
      password: '',
      role: Role.CLIENT,
      cluster: '',
    };
    this.showCreateModal = true;
  }

  createUser(): void {
    this.saving = true;
    this.actionError = '';
    this.api
      .post<User>('/users', {
        ...this.createForm,
        cluster: this.createForm.cluster || undefined,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.showCreateModal = false;
          this.toast.success('User created successfully');
          this.loadUsers();
        },
        error: (err: unknown) => {
          this.saving = false;
          this.actionError = extractApiError(err, 'Failed to create user').message;
        },
      });
  }

  openEdit(user: User): void {
    this.actionError = '';
    this.selectedUserId = user._id;
    this.editForm = {
      name: user.name,
      phone: user.phone ?? '',
      role: user.role,
      cluster: user.cluster ?? '',
      isActive: user.isActive,
    };
    this.showEditModal = true;
  }

  saveEdit(): void {
    if (!this.selectedUserId) return;
    this.saving = true;
    this.actionError = '';

    this.api
      .patch<User>(`/users/${this.selectedUserId}`, {
        ...this.editForm,
        cluster: this.editForm.cluster || undefined,
        phone: this.editForm.phone?.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.showEditModal = false;
          this.toast.success('User updated successfully');
          this.loadUsers();
        },
        error: (err: unknown) => {
          this.saving = false;
          this.actionError = extractApiError(err, 'Failed to update user').message;
        },
      });
  }

  toggleActive(user: User): void {
    this.actionError = '';
    this.api.patch<User>(`/users/${user._id}`, { isActive: !user.isActive }).subscribe({
      next: () => {
        this.toast.success(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
        this.loadUsers();
      },
      error: (err: unknown) => {
        this.actionError = extractApiError(err, 'Failed to update user status').message;
      },
    });
  }

  deleteUser(user: User): void {
    this.userToDelete = user;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (!this.userToDelete) return;
    this.actionError = '';
    this.saving = true;
    this.api.delete<{ success: boolean }>(`/users/${this.userToDelete._id}`).subscribe({
      next: () => {
        this.saving = false;
        this.showDeleteModal = false;
        this.userToDelete = null;
        this.toast.success('User deleted successfully');
        this.loadUsers();
      },
      error: (err: unknown) => {
        this.saving = false;
        this.actionError = extractApiError(err, 'Failed to delete user').message;
      },
    });
  }

  trackById(_: number, item: { _id: string }): string {
    return item._id;
  }

  roleChipClass(role: string): string {
    switch ((role || '').toLowerCase()) {
      case 'admin':
        return 'bb-chip-neutral';
      case 'case_manager':
        return 'bb-chip-success';
      case 'vendor':
        return 'bb-chip-warning';
      case 'qa':
        return 'bb-chip-info';
      case 'client':
        return 'bb-chip-info';
      case 'ops_finance':
        return 'bb-chip-success';
      default:
        return 'bb-chip-neutral';
    }
  }
}
