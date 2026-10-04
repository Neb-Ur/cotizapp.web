import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({ standalone: true, imports: [RouterLink], template: '<main style="padding:4rem"><h1>Página no encontrada</h1><p>El enlace no existe o ya no está disponible.</p><a routerLink="/buscar">Buscar materiales</a></main>' })
export class NotFoundComponent {}
