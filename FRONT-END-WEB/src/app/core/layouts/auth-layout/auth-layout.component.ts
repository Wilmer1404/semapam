import { Component } from '@angular/core';

@Component({
	selector: 'app-auth-layout',
	template: '<div class="auth-layout"><router-outlet></router-outlet></div>',
	styles: [
		`.auth-layout{min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top right, rgba(54,185,230,.16), transparent 32%),linear-gradient(135deg,#0f4c81 0%,#1d6ea6 54%,#8eb8d6 54%);padding:24px}`
	]
})
export class AuthLayoutComponent {}
