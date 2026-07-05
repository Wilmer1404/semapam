import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SessionUser } from '@shared/models/user.model';
import { TokenStorageService } from './token-storage.service';
@Injectable({providedIn:'root'}) export class SessionService{
  private readonly store=inject(TokenStorageService);
  private subj=new BehaviorSubject<SessionUser|null>(this.store.getProfile<SessionUser>());
  currentUser$=this.subj.asObservable();
  setUser(u:SessionUser){this.store.setProfile(u);this.subj.next(u)}
  clear(){this.store.clear();this.subj.next(null)}
  get snapshot(){return this.subj.value}
}
