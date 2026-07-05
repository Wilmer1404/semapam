import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@shared/models/api-response.model';
@Injectable({providedIn:'root'}) export class ApiBaseService{
  protected readonly apiUrl=environment.apiBaseUrl;
  constructor(protected http:HttpClient){}
  protected get<T>(path:string, params?:Record<string,string|number|boolean|undefined>):Observable<ApiResponse<T>>{
    let httpParams=new HttpParams();
    Object.entries(params||{}).forEach(([k,v])=>{ if(v!==undefined && v!==null && v!=='') httpParams=httpParams.set(k,String(v)); });
    return this.http.get<ApiResponse<T>>(`${this.apiUrl}${path}`,{params:httpParams});
  }
  protected post<T>(path:string, body?:unknown){ return this.http.post<ApiResponse<T>>(`${this.apiUrl}${path}`, body??{}); }
  protected put<T>(path:string, body?:unknown){ return this.http.put<ApiResponse<T>>(`${this.apiUrl}${path}`, body??{}); }
  protected delete<T>(path:string){ return this.http.delete<ApiResponse<T>>(`${this.apiUrl}${path}`); }
}
