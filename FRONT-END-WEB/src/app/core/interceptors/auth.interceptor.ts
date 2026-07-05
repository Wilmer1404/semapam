import { Injectable } from '@angular/core';
import { HttpEvent,HttpHandler,HttpInterceptor,HttpRequest,HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { TokenStorageService } from '../services/token-storage.service';
@Injectable() export class AuthInterceptor implements HttpInterceptor{
  constructor(private store:TokenStorageService, private router:Router){}
  intercept(req:HttpRequest<unknown>, next:HttpHandler):Observable<HttpEvent<unknown>>{
    const token=this.store.getToken(); const cloned=token?req.clone({setHeaders:{Authorization:`Bearer ${token}`}}):req;
    return next.handle(cloned).pipe(catchError((error:HttpErrorResponse)=>{ if(error.status===401&&!this.isLoginRequest(req.url)){ this.store.clear(); void this.router.navigate(['/auth/login']); } return throwError(()=>error); }));
  }

  private isLoginRequest(url:string):boolean{
    return /\/login(?:\?|$)/i.test(url);
  }
}
