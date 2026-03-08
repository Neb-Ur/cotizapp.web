import type { EstadoCuenta, PlanSuscripcion, RolUsuario } from '../models/entities.js';

export interface LoginRequestDto {
  correo: string;
  password: string;
  remember?: boolean;
}

export interface RegisterRequestDto {
  rol: Exclude<RolUsuario, 'admin'>;
  nombre: string;
  correo: string;
  password: string;
  telefono: string;
  ciudad: string;
  comuna: string;
  direccion: string;
  nombreComercial?: string;
  rut?: string;
}

export interface AuthUserResponseDto {
  id: string;
  rol: RolUsuario;
  nombre: string;
  correo: string;
  telefono: string;
  ciudad: string;
  comuna: string;
  direccion: string;
  planSuscripcion: PlanSuscripcion;
  estadoCuenta: EstadoCuenta;
  nombreComercial?: string;
  rut?: string;
}

export interface LoginResponseDto {
  token: string;
  usuario: AuthUserResponseDto;
}

export interface UpdateProfileRequestDto {
  nombre?: string;
  telefono?: string;
  ciudad?: string;
  comuna?: string;
  direccion?: string;
  planSuscripcion?: PlanSuscripcion;
}
