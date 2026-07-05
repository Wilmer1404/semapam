import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { BehaviorSubject, switchMap } from 'rxjs';
import { User } from '@shared/models/user.model';
import { UsersService } from '../../services/users.service';
import { NotificationService } from '@core/services/notification.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';

@Component({
  selector: 'app-usuarios-page',
  templateUrl: './usuarios-page.component.html',
  styleUrls: ['./usuarios-page.component.scss'],
  providers: [UsersService]
})
export class UsuariosPageComponent implements OnInit {
  private readonly svc = inject(UsersService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  displayedColumns = ['username', 'full_name', 'role', 'dni', 'phone', 'status', 'actions'];
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  pagedUsers: User[] = [];
  totalUsers = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];
  editingId: number | null = null;
  formVisible = false;
  draftPassword = '';
  filters = {
    search: '',
    role: 'ALL',
    status: 'ALL'
  };

  draftUser: User = {
    username: '',
    full_name: '',
    role: 'OPERADOR',
    dni: '',
    phone: '',
    status: true
  };

  roleOptions = ['ADMIN', 'OPERADOR'];

  ngOnInit(): void {
    this.reload$.pipe(
      switchMap(() => this.svc.list()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.allUsers = response.data || [];
        this.applyFilters();
      },
      error: (error) => {
        this.notification.error(error?.error?.message || 'No se pudo cargar el listado de usuarios.');
      }
    });
  }

  newUser(): void {
    this.formVisible = true;
    this.editingId = null;
    this.resetDraftUser();
  }

  toggleCreateUserForm(): void {
    if (this.formVisible && this.editingId === null) {
      this.cancel();
      return;
    }

    this.newUser();
  }

  reloadCatalog(): void {
    this.reload$.next();
  }

  editUser(row: User): void {
    this.formVisible = true;
    this.editingId = row.id || null;
    this.draftPassword = '';
    this.draftUser = { ...row };
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.applyFilters();
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      role: 'ALL',
      status: 'ALL'
    };
    this.pageIndex = 0;
    this.applyFilters();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePageSlice();
  }

  saveUser(): void {
    if (!this.draftUser.username?.trim() || !this.draftUser.full_name?.trim()) {
      this.notification.error('Username y nombre completo son obligatorios.');
      return;
    }

    if (!this.editingId && !this.draftPassword.trim()) {
      this.notification.error('La contraseña es obligatoria para crear usuario.');
      return;
    }

    const payload = {
      ...this.draftUser,
      ...(this.draftPassword.trim() ? { password: this.draftPassword.trim() } : {})
    };

    const request$ = this.editingId
      ? this.svc.update(this.editingId, payload)
      : this.svc.create({ ...payload, password: this.draftPassword.trim() });

    request$.subscribe({
      next: () => {
        this.notification.success(this.editingId ? 'Usuario actualizado.' : 'Usuario creado.');
        this.cancel();
        this.reload$.next();
      },
      error: (error) => this.notification.error(error?.error?.message || 'No se pudo guardar el usuario.')
    });
  }

  deleteUser(row: User): void {
    if (!row.id) {
      this.notification.error('No se puede eliminar un usuario sin ID.');
      return;
    }

    this.svc.deleteUser(row.id).subscribe({
      next: () => {
        this.notification.success('Usuario eliminado.');
        if (this.editingId === row.id) {
          this.newUser();
        }
        this.reload$.next();
      },
      error: (error) => this.notification.error(error?.error?.message || 'No se pudo eliminar el usuario.')
    });
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
    this.resetDraftUser();
  }

  private applyFilters(): void {
    const search = this.filters.search.trim().toLowerCase();
    this.filteredUsers = this.allUsers.filter((user) => {
      const matchesSearch = !search || [user.username, user.full_name, user.dni, user.phone]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));

      const matchesRole = this.filters.role === 'ALL' || user.role === this.filters.role;
      const matchesStatus = this.filters.status === 'ALL'
        || (this.filters.status === 'ACTIVE' && !!user.status)
        || (this.filters.status === 'INACTIVE' && !user.status);

      return matchesSearch && matchesRole && matchesStatus;
    });

    this.totalUsers = this.filteredUsers.length;
    if (this.pageIndex > 0 && this.pageIndex * this.pageSize >= this.totalUsers) {
      this.pageIndex = 0;
    }
    this.updatePageSlice();
  }

  private updatePageSlice(): void {
    const start = this.pageIndex * this.pageSize;
    this.pagedUsers = this.filteredUsers.slice(start, start + this.pageSize);
  }

  private resetDraftUser(): void {
    this.draftPassword = '';
    this.draftUser = {
      username: '',
      full_name: '',
      role: 'OPERADOR',
      dni: '',
      phone: '',
      status: true
    };
  }
}
