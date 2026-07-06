import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@awesome-cordova-plugins/bluetooth-serial/ngx';
import { BluetoothPairedDevice } from '../../shared/interfaces/printer-config.interface';

export interface DeviceBuildInfo {
  platform: string;
  sdkVersion: number;
  androidRelease: string;
  manufacturer: string;
  model: string;
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  constructor(private readonly bluetoothSerial: BluetoothSerial) {}

  supportsBluetoothClassic(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  getAndroidSdkVersion(): number {
    if (Capacitor.getPlatform() !== 'android') {
      return 0;
    }
    try {
      const userAgent = navigator.userAgent || '';
      const match = userAgent.match(/Android\s+(\d+)/i);
      if (match && match[1]) {
        const apiLevel = parseInt(match[1], 10);
        if (apiLevel > 0 && apiLevel < 50) {
          return apiLevel;
        }
      }
    } catch {
    }
    return 0;
  }

  isAndroid9OrLower(): boolean {
    const sdk = this.getAndroidSdkVersion();
    return sdk > 0 && sdk <= 28;
  }

  getBuildInfo(): DeviceBuildInfo {
    const platform = Capacitor.getPlatform();
    const userAgent = navigator.userAgent || '';
    const androidMatch = userAgent.match(/Android\s+([\d.]+)/i);
    const releaseMatch = userAgent.match(/Android\s+\d+(?:\.\d+)*;\s*([^;)]+)/i);

    let sdkVersion = 0;
    const sdkMatch = userAgent.match(/Android\s+(\d+)/i);
    if (sdkMatch && sdkMatch[1]) {
      sdkVersion = parseInt(sdkMatch[1], 10);
    }

    return {
      platform,
      sdkVersion,
      androidRelease: androidMatch ? androidMatch[1] : 'unknown',
      manufacturer: releaseMatch ? releaseMatch[1].trim() : 'unknown',
      model: 'unknown'
    };
  }

  async ensureBluetoothPermissions(): Promise<{ granted: boolean; missing: string[] }> {
    if (!this.supportsBluetoothClassic()) {
      return { granted: false, missing: ['platform'] };
    }

    const missing: string[] = [];

    try {
      const btEnabled = await this.isBluetoothEnabled();
      if (!btEnabled) {
        missing.push('bluetooth_disabled');
      }
    } catch {
      missing.push('bluetooth_check_failed');
    }

    return { granted: missing.length === 0, missing };
  }

  async isBluetoothEnabled(): Promise<boolean> {
    if (!this.supportsBluetoothClassic()) {
      return false;
    }

    try {
      await this.bluetoothSerial.isEnabled();
      return true;
    } catch {
      return false;
    }
  }

  async getPosBluetoothMac(): Promise<string> {
    if (!this.supportsBluetoothClassic()) {
      return '';
    }

    try {
      const bridge = this.bluetoothSerial as unknown as { getAddress?: () => Promise<string> };
      const mac = bridge.getAddress ? await bridge.getAddress() : '';
      return this.normalizeMac(mac);
    } catch {
      return '';
    }
  }

  async listPairedDevices(): Promise<BluetoothPairedDevice[]> {
    if (!this.supportsBluetoothClassic()) {
      return [];
    }

    try {
      const devices = (await this.bluetoothSerial.list()) as Array<
        { name?: string; id?: string; address?: string } | null | undefined
      >;

      return (devices ?? [])
        .filter((device): device is { name?: string; id?: string; address?: string } => !!device)
        .map((device) => {
          const mac = this.normalizeMac(device.address ?? device.id ?? '');
          return {
            name: (device.name ?? 'Dispositivo sin nombre').trim(),
            mac
          };
        })
        .filter((device) => !!device.mac);
    } catch {
      return [];
    }
  }

  async findPairedDevice(mac: string): Promise<BluetoothPairedDevice | null> {
    const normalized = this.normalizeMac(mac);
    if (!normalized) {
      return null;
    }

    const devices = await this.listPairedDevices();
    return devices.find((item) => this.normalizeMac(item.mac) === normalized) ?? null;
  }

  async openBluetoothSettings(): Promise<boolean> {
    if (!this.supportsBluetoothClassic()) {
      return false;
    }

    try {
      await this.bluetoothSerial.showBluetoothSettings();
      return true;
    } catch {
      return false;
    }
  }

  normalizeMac(mac: string): string {
    return (mac ?? '').trim().toUpperCase();
  }

  isLikelyRandomBleAddress(mac: string): boolean {
    const normalized = this.normalizeMac(mac);
    const firstOctet = normalized.split(':')[0];
    if (!firstOctet || firstOctet.length !== 2) {
      return false;
    }

    const value = parseInt(firstOctet, 16);
    if (Number.isNaN(value)) {
      return false;
    }

    // Locally administered bit is commonly set in randomized BLE addresses.
    return (value & 0x02) === 0x02;
  }
}
