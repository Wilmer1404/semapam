import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { App } from '@capacitor/app';
import { Network, ConnectionStatus } from '@capacitor/network';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly onlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  readonly online$ = this.onlineSubject.asObservable();

  constructor() {
    this.bindNativeConnectivity().catch(() => undefined);

    // Browser fallback (still useful on web builds).
    window.addEventListener('online', () => this.onlineSubject.next(true));
    window.addEventListener('offline', () => this.onlineSubject.next(false));

    // On some POS devices, network state updates after app resumes.
    App.addListener('resume', () => {
      this.refreshStatus().catch(() => undefined);
    });
  }

  isOnline(): boolean {
    return this.onlineSubject.value;
  }

  private async bindNativeConnectivity(): Promise<void> {
    await this.refreshStatus();
    await Network.addListener('networkStatusChange', (status) => this.applyStatus(status));
  }

  private async refreshStatus(): Promise<void> {
    const status = await Network.getStatus();
    this.applyStatus(status);
  }

  private applyStatus(status: ConnectionStatus): void {
    this.onlineSubject.next(status.connected);
  }
}
