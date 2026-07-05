import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { StatusDialogService } from '@core/services/status-dialog.service';
import { SessionUser } from '@shared/models/user.model';
@Component({selector:'app-login-page',templateUrl:'./login-page.component.html',styleUrls:['./login-page.component.scss']})
export class LoginPageComponent{
  private readonly fb=inject(FormBuilder);
  private readonly auth=inject(AuthService);
  private readonly router=inject(Router);
  private readonly statusDialog=inject(StatusDialogService);
  loading=false;
  form=this.fb.group({username:['',[Validators.required]],password:['',[Validators.required]]});
  submit(){
    if(this.form.invalid){
      this.form.markAllAsTouched();
      return;
    }

    this.loading=true;
    this.auth.login(this.form.getRawValue() as {username:string; password:string}).pipe(
      finalize(()=>this.loading=false)
    ).subscribe({
      next:(user:SessionUser)=>{
        if(!this.isAdminUser(user)){
          this.auth.logout();
          this.statusDialog.open({
            variant:'warning',
            title:'Acceso restringido',
            message:'Solo los usuarios con rol ADMIN pueden ingresar al panel.',
            buttonText:'Entendido'
          });
          return;
        }

        void this.router.navigate(['/arqueo']);
      },
      error:(error:HttpErrorResponse)=>{
        const message=this.resolveLoginErrorMessage(error);
        this.statusDialog.open({
          variant:error.status===401?'warning':'error',
          title:error.status===401?'Credenciales inválidas':'Error al iniciar sesión',
          message,
          buttonText:'Reintentar'
        });
      }
    });
  }

  private resolveLoginErrorMessage(error:HttpErrorResponse):string{
    if(error.status===401){
      return 'Usuario o contraseña incorrectos.';
    }

    const backendMessage=error.error?.message||error.error?.error||error.error?.detail;
    if(typeof backendMessage==='string'&&backendMessage.trim().length>0){
      return backendMessage;
    }

    if(error.status===0){
      return 'No se pudo conectar con el servidor.';
    }

    return 'No se pudo iniciar sesión. Intenta nuevamente.';
  }

  private isAdminUser(user:SessionUser):boolean{
    return String(user.role||'').toUpperCase()==='ADMIN';
  }
}
