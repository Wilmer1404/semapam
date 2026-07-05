import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import { SessionUser } from '@shared/models/user.model';
import { TokenStorageService } from './token-storage.service';
import { SessionService } from './session.service';
interface LoginPayload{ username:string; password:string; }
interface LoginResponse{
  token:string;
  user:SessionUser & { nombre?: string };
}
@Injectable({providedIn:'root'}) export class AuthService extends ApiBaseService{
  constructor(http:HttpClient, private store:TokenStorageService, private session:SessionService){ super(http); }
  login(payload:LoginPayload){
    return this.post<LoginResponse>('/login',payload).pipe(
      tap(r=>{
        const user=this.toSessionUser(r.data.user,r.data.token);
        this.store.setToken(r.data.token);
        this.session.setUser(user);
      }),
      map(r=>this.toSessionUser(r.data.user,r.data.token))
    );
  }
  me(){ return this.get<SessionUser & { nombre?: string }>('/me').pipe(tap(r=>this.session.setUser(this.toSessionUser(r.data))), map(r=>this.toSessionUser(r.data))); }
  logout(){ this.store.clear(); this.session.clear(); }

  private toSessionUser(user: SessionUser & { nombre?: string }, token?: string): SessionUser {
    return {
      ...user,
      full_name: user.full_name ?? user.nombre ?? user.username,
      token: token ?? user.token
    };
  }
}
