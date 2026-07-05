import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage {
  username = '';
  password = '';
  isBusy = false;
  errorMessage = '';

  constructor(private auth: AuthService, private toastCtrl: ToastController, private router: Router) {}

  async ionViewWillEnter(): Promise<void> {
    if (!this.auth.hasSession()) {
      return;
    }

    const user = await this.auth.me();
    if (user) {
      await this.router.navigateByUrl('/splash', { replaceUrl: true });
    }
  }

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.isBusy = true;

    try {
      const ok = await this.auth.login(this.username, this.password);
      if (!ok) {
        const message = this.auth.getLastLoginError() || 'No se pudo iniciar sesión.';
        this.errorMessage = message;
        const toast = await this.toastCtrl.create({ message, duration: 2600, color: 'danger' });
        await toast.present();
      }
    } finally {
      this.isBusy = false;
    }
  }
}
