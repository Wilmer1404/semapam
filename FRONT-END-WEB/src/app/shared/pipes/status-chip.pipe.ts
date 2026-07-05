import { Pipe, PipeTransform } from '@angular/core';
@Pipe({name:'statusChip'}) export class StatusChipPipe implements PipeTransform {
 transform(value:string|boolean|null|undefined):string{ const n=`${value??''}`.toLowerCase(); if(['true','active','success','printed','synced','published','sí','si','auto'].includes(n)) return 'status-success'; if(['warning','pending','manual'].includes(n)) return 'status-warning'; if(['false','inactive','error','failed','unsynced','unresolved','no'].includes(n)) return 'status-error'; return 'status-info';}
}
