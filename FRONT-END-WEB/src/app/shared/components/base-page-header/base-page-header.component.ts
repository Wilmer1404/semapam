import { Component, Input } from '@angular/core';
@Component({selector:'app-base-page-header',templateUrl:'./base-page-header.component.html',styleUrls:['./base-page-header.component.scss']})
export class BasePageHeaderComponent { @Input() title=''; @Input() subtitle=''; }
