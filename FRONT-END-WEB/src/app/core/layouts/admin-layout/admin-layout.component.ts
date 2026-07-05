import { Component, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { Router } from '@angular/router';
import { NAVIGATION_ITEMS } from '../../constants/navigation.constants';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../../environments/environment';
@Component({selector:'app-admin-layout',templateUrl:'./admin-layout.component.html',styleUrls:['./admin-layout.component.scss']})
export class AdminLayoutComponent{
  @ViewChild('sidenav') sidenav?:MatSidenav;
  items=NAVIGATION_ITEMS;
  branding=environment.branding;
  sidenavOpened=true;
  constructor(private auth:AuthService, private router:Router){}
  toggleSidenav(){ void this.sidenav?.toggle(); }
  logout(){ this.auth.logout(); void this.router.navigate(['/auth/login']); }
}
