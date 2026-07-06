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
    const encoded = new TextEncoder().encode(secret);

    if (globalThis.crypto?.subtle) {
      try {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
        const bytes = Array.from(new Uint8Array(digest));
        return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch {
      }
    }

    return this.sha256Pure(encoded);
  }

  private sha256Pure(data: Uint8Array): string {
    const K: number[] = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    const msgBits = data.length * 8;
    const padLen = ((msgBits + 64) >> 9) + 1 << 4;
    const padded = new Uint8Array(padLen * 4);
    padded.set(data);
    padded[data.length] = 0x80;

    const view = new DataView(padded.buffer);
    const len = padded.length;
    view.setUint32(len - 4, msgBits >>> 0, false);
    view.setUint32(len - 8, Math.floor(msgBits / 0x100000000), false);

    const H: number[] = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    const W: number[] = new Array(64);

    for (let i = 0; i < len; i += 64) {
      for (let t = 0; t < 16; t++) {
        W[t] = view.getUint32(i + t * 4, false);
      }

      for (let t = 16; t < 64; t++) {
        const s0 = (this.rotr(W[t - 15], 7) ^ this.rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3)) >>> 0;
        const s1 = (this.rotr(W[t - 2], 17) ^ this.rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10)) >>> 0;
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }

      let a = H[0], b = H[1], c = H[2], d = H[3];
      let e = H[4], f = H[5], g = H[6], hh = H[7];

      for (let t = 0; t < 64; t++) {
        const S1 = (this.rotr(e, 6) ^ this.rotr(e, 11) ^ this.rotr(e, 25)) >>> 0;
        const ch = ((e & f) ^ (~e & g)) >>> 0;
        const temp1 = (hh + S1 + ch + K[t] + W[t]) >>> 0;
        const S0 = (this.rotr(a, 2) ^ this.rotr(a, 13) ^ this.rotr(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const temp2 = (S0 + maj) >>> 0;

        hh = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + hh) >>> 0;
    }

    const output = new Uint8Array(32);
    const outView = new DataView(output.buffer);
    for (let i = 0; i < 8; i++) {
      outView.setUint32(i * 4, H[i], false);
    }

    return Array.from(output).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private rotr(value: number, amount: number): number {
    return ((value >>> amount) | (value << (32 - amount))) >>> 0;
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
