import { Component, Input } from '@angular/core';
@Component({selector:'app-quick-stat-card',templateUrl:'./quick-stat-card.component.html',styleUrls:['./quick-stat-card.component.scss']})
export class QuickStatCardComponent { @Input() label=''; @Input() value=''; @Input() icon='insights'; @Input() tone:'info'|'success'|'warning'|'error'='info'; }
