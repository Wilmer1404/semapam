import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ApiResponse } from '../../shared/interfaces/api-response.interface';
import { APP_CONSTANTS } from '../../shared/constants/app.constants';
import { LoginApiData, MeApiData } from '../../shared/interfaces/backend.interface';
import { SessionData, User } from '../models/models';
import { ApiConfigService } from './api-config.service';
import { LocalStorageService } from './local-storage.service';

interface OfflineAuthCache {
  username: string;
  passwordHash: string;
  user: User;
  lastLoginAt: string;
}

type UserCorrelativos = Record<string, number>;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSubject = new BehaviorSubject<SessionData | null>(null);
  private lastLoginError = '';
  readonly session$ = this.sessionSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly apiConfig: ApiConfigService,
    private readonly storage: LocalStorageService
  ) {
    this.bootstrapSession().catch(() => undefined);
  }

  async login(username: string, password: string): Promise<boolean> {
    const normalizedUsername = username.trim();
    this.lastLoginError = '';

    if (!normalizedUsername || !password) {
      this.lastLoginError = 'Ingrese usuario y contraseña.';
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<LoginApiData>>(
          this.apiConfig.getApiUrl('/login'),
          { username: normalizedUsername, password }
        )
      );

      if (!response.status || !response.data?.token) {
        this.lastLoginError = response.message?.trim() || 'Credenciales inválidas.';
        return false;
      }

      const user: User = {
        id: response.data.id,
        username: response.data.username,
        name: response.data.nombre,
        role: response.data.role ?? '',
        correlativo: this.normalizeCorrelativo(response.data.correlativo)
      };

      const session: SessionData = {
        token: response.data.token,
        user,
        loginAt: new Date().toISOString()
      };

      await this.storage.set(APP_CONSTANTS.storageKeys.session, session);
      await this.persistUserCorrelativo(user.id, user.correlativo);
      await this.persistOfflineAuthCache(normalizedUsername, password, user);
      this.sessionSubject.next(session);
      await this.router.navigateByUrl('/splash', { replaceUrl: true });
      return true;
    } catch (error) {
      const offlineOk = await this.tryOfflineLogin(normalizedUsername, password);
      if (offlineOk) {
        return true;
      }

      this.lastLoginError = this.resolveLoginErrorMessage(error);
      return false;
    }
  }

  getLastLoginError(): string {
    return this.lastLoginError;
  }

  async me(): Promise<User | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<MeApiData>>(this.apiConfig.getApiUrl('/me'))
      );

      if (!response.status) {
        return null;
      }

      const user: User = {
        id: response.data.id,
        username: response.data.username,
        name: response.data.nombre,
        role: response.data.role ?? '',
        correlativo: this.normalizeCorrelativo(response.data.correlativo)
      };

      const session = this.sessionSubject.value;
      if (session) {
        const next: SessionData = { ...session, user };
        await this.storage.set(APP_CONSTANTS.storageKeys.session, next);
        this.sessionSubject.next(next);
      }

      await this.persistUserCorrelativo(user.id, user.correlativo);

      return user;
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        return null;
      }

      const cachedUser = this.sessionSubject.value?.user ?? null;
      if (cachedUser) {
        console.warn('[AUTH] Using cached user due to /me connectivity failure');
        return cachedUser;
      }

      return null;
    }
  }

  getToken(): string | null {
    return this.sessionSubject.value?.token ?? null;
  }

  getCurrentUser(): User | null {
    return this.sessionSubject.value?.user ?? null;
  }

  hasSession(): boolean {
    return !!this.sessionSubject.value?.token;
  }

  async consumeNextCorrelativo(userId: number | undefined): Promise<number> {
    const normalizedUserId = this.normalizeUserId(userId);
    const userKey = String(normalizedUserId);

    const correlativos =
      (await this.storage.get<UserCorrelativos>(APP_CONSTANTS.storageKeys.userCorrelativos)) ?? {};

    const current = Number.isFinite(correlativos[userKey])
      ? Math.max(0, Math.trunc(correlativos[userKey]))
      : this.normalizeCorrelativo(this.sessionSubject.value?.user.correlativo);

    const next = current + 1;
    correlativos[userKey] = next;
    await this.storage.set(APP_CONSTANTS.storageKeys.userCorrelativos, correlativos);

    const session = this.sessionSubject.value;
    if (session && session.user.id === normalizedUserId) {
      const nextSession: SessionData = {
        ...session,
        user: {
          ...session.user,
          correlativo: next
        }
      };
      await this.storage.set(APP_CONSTANTS.storageKeys.session, nextSession);
      this.sessionSubject.next(nextSession);
    }

    return next;
  }

  async logout(): Promise<void> {
    await this.clearSession();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async clearSession(): Promise<void> {
    await this.storage.remove(APP_CONSTANTS.storageKeys.session);
    this.sessionSubject.next(null);
  }

  private async bootstrapSession(): Promise<void> {
    const session = await this.storage.get<SessionData>(APP_CONSTANTS.storageKeys.session);
    if (!session?.token) {
      return;
    }

    this.sessionSubject.next(session);
  }

  private async persistOfflineAuthCache(username: string, password: string, user: User): Promise<void> {
    const cache: OfflineAuthCache = {
      username: username.toLowerCase(),
      passwordHash: await this.hashSecret(password),
      user,
      lastLoginAt: new Date().toISOString()
    };

    await this.storage.set(APP_CONSTANTS.storageKeys.authCache, cache);
  }

  private async tryOfflineLogin(username: string, password: string): Promise<boolean> {
    const cache = await this.storage.get<OfflineAuthCache>(APP_CONSTANTS.storageKeys.authCache);
    if (!cache) {
      return false;
    }

    const usernameOk = cache.username === username.toLowerCase();
    const passwordOk = cache.passwordHash === (await this.hashSecret(password));

    if (!usernameOk || !passwordOk) {
      return false;
    }

    const existingSession = this.sessionSubject.value;
    const session: SessionData = {
      token: existingSession?.token || `offline-${Date.now()}`,
      user: cache.user,
      loginAt: new Date().toISOString()
    };

    await this.storage.set(APP_CONSTANTS.storageKeys.session, session);
    this.sessionSubject.next(session);
    await this.router.navigateByUrl('/splash', { replaceUrl: true });
    return true;
  }

  private async persistUserCorrelativo(userId: number, correlativo: number | undefined): Promise<void> {
    const normalizedUserId = this.normalizeUserId(userId);
    const normalizedCorrelativo = this.normalizeCorrelativo(correlativo);
    if (normalizedCorrelativo <= 0) {
      return;
    }

    const userKey = String(normalizedUserId);
    const correlativos =
      (await this.storage.get<UserCorrelativos>(APP_CONSTANTS.storageKeys.userCorrelativos)) ?? {};

    const existing = Number.isFinite(correlativos[userKey]) ? Math.max(0, Math.trunc(correlativos[userKey])) : 0;
    correlativos[userKey] = Math.max(existing, normalizedCorrelativo);
    await this.storage.set(APP_CONSTANTS.storageKeys.userCorrelativos, correlativos);
  }

  private normalizeUserId(userId: number | undefined): number {
    if (typeof userId !== 'number' || !Number.isFinite(userId) || userId < 0) {
      return 0;
    }

    return Math.trunc(userId);
  }

  private normalizeCorrelativo(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return 0;
    }

    return Math.trunc(value);
  }

  private async hashSecret(secret: string): Promise<string> {
    if (globalThis.crypto?.subtle) {
      const encoded = new TextEncoder().encode(secret);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
      const bytes = Array.from(new Uint8Array(digest));
      return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    return btoa(secret);
  }

  private resolveLoginErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendError = error.error as
        | { message?: string; errors?: Record<string, string[] | string> }
        | string
        | null;

      if (error.status === 0) {
        return 'Sin internet y no existe una sesión local válida para este usuario.';
      }

      if (error.status === 401 || error.status === 403) {
        if (typeof backendError === 'string' && backendError.trim()) {
          return backendError;
        }

        if (backendError && typeof backendError === 'object') {
          if (backendError.message?.trim()) {
            return backendError.message;
          }

          const firstError = Object.values(backendError.errors ?? {})[0];
          if (Array.isArray(firstError) && firstError[0]?.trim()) {
            return firstError[0];
          }
          if (typeof firstError === 'string' && firstError.trim()) {
            return firstError;
          }
        }

        return 'Credenciales inválidas.';
      }

      if (backendError && typeof backendError === 'object' && backendError.message?.trim()) {
        return backendError.message;
      }
    }

    return 'No se pudo iniciar sesión. Intente nuevamente.';
  }
}
