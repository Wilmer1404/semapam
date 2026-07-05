import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { ApiBaseService } from '@core/services/api-base.service';
import { User } from '@shared/models/user.model';

@Injectable()
export class UsersService extends ApiBaseService {
	constructor(http: HttpClient) { super(http); }

	list() {
		return this.get<UserAdmin[]>('/users').pipe(
			map((response) => ({
				...response,
				data: (response.data || []).map((item) => this.toUser(item))
			}))
		);
	}

	getById(id: number) {
		return this.get<UserAdmin>(`/users/${id}`).pipe(
			map((response) => ({ ...response, data: this.toUser(response.data) }))
		);
	}

	create(payload: UserCreatePayload) {
		return this.post<UserAdmin>('/users', this.toUserPayload(payload)).pipe(
			map((response) => ({ ...response, data: this.toUser(response.data) }))
		);
	}

	update(id: number, payload: UserUpdatePayload) {
		return this.put<UserAdmin>(`/users/${id}`, this.toUserPayload(payload)).pipe(
			map((response) => ({ ...response, data: this.toUser(response.data) }))
		);
	}

	deleteUser(id: number) {
		return this.delete<void>(`/users/${id}`);
	}

	private toUser(admin: UserAdmin): User {
		return {
			id: admin.id,
			username: admin.username,
			full_name: admin.full_name,
			role: admin.role,
			dni: admin.dni || '',
			phone: admin.phone || '',
			status: admin.status === 'ACTIVE'
		};
	}

	private toUserPayload(payload: UserCreatePayload | UserUpdatePayload): Record<string, unknown> {
		const mappedStatus =
			typeof payload.status === 'boolean'
				? payload.status ? 'ACTIVE' : 'INACTIVE'
				: payload.status;

		return {
			...(payload.username !== undefined ? { username: payload.username } : {}),
			...(payload.password !== undefined ? { password: payload.password } : {}),
			...(payload.full_name !== undefined ? { full_name: payload.full_name } : {}),
			...(payload.role !== undefined ? { role: payload.role } : {}),
			...(payload.dni !== undefined ? { dni: payload.dni } : {}),
			...(payload.phone !== undefined ? { phone: payload.phone } : {}),
			...(mappedStatus !== undefined ? { status: mappedStatus } : {})
		};
	}
}

type UserStatusApi = 'ACTIVE' | 'BLOCKED' | 'INACTIVE';

interface UserAdmin {
	id: number;
	username: string;
	full_name: string;
	role: User['role'];
	dni: string | null;
	phone: string | null;
	status: UserStatusApi;
}

export interface UserCreatePayload {
	username: string;
	password: string;
	full_name: string;
	role?: User['role'];
	dni?: string;
	phone?: string;
	status?: boolean | UserStatusApi;
}

export interface UserUpdatePayload {
	username?: string;
	password?: string;
	full_name?: string;
	role?: User['role'];
	dni?: string;
	phone?: string;
	status?: boolean | UserStatusApi;
}
