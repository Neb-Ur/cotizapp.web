import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

interface SeoPage {
  title: string;
  description: string;
  index?: boolean;
}

const SITE_URL = 'https://cotizapp-d71c8.web.app';
const DEFAULT_PAGE: SeoPage = {
  title: 'CotizApp | Compara precios de materiales de construccion',
  description: 'Compara precios y stock de materiales entre ferreterias y arma tu cotizacion de obra en minutos.'
};

const PAGE_SEO: Record<string, SeoPage> = {
  '/': DEFAULT_PAGE,
  '/buscar': {
    title: 'Buscar materiales y comparar precios | CotizApp',
    description: 'Busca materiales de construccion y compara precios y disponibilidad entre ferreterias activas sin crear una cuenta.'
  },
  '/producto': {
    title: 'Comparar precios de productos | CotizApp',
    description: 'Revisa precios, stock y alternativas disponibles para tus materiales de construccion.'
  },
  '/maestros': {
    title: 'Cotizaciones para maestros y contratistas | CotizApp',
    description: 'Compara materiales, optimiza costos y guarda cotizaciones para cada proyecto de construccion.'
  },
  '/ferreterias': {
    title: 'CotizApp para ferreterias | Solicita acceso',
    description: 'Publica tu catalogo, precio y stock para participar en las comparaciones de maestros y contratistas.'
  },
  '/contacto': {
    title: 'Contacto y solicitud de acceso | CotizApp',
    description: 'Contacta a CotizApp para soporte o para solicitar acceso como ferreteria.'
  },
  '/preguntas-frecuentes': {
    title: 'Preguntas frecuentes | CotizApp',
    description: 'Resuelve dudas sobre busqueda de productos, cotizaciones, cuentas de maestro y acceso para ferreterias.'
  },
  '/terminos-condiciones': {
    title: 'Terminos y condiciones | CotizApp',
    description: 'Condiciones de uso de CotizApp para visitantes, maestros y ferreterias.'
  },
  '/privacidad': {
    title: 'Politica de privacidad | CotizApp',
    description: 'Conoce como CotizApp trata y protege los datos personales de sus usuarios.'
  },
  '/login': {
    title: 'Iniciar sesion | CotizApp',
    description: 'Accede a tu cuenta de CotizApp.',
    index: false
  },
  '/registro': {
    title: 'Crear cuenta de maestro | CotizApp',
    description: 'Crea una cuenta de maestro para guardar cotizaciones y consultar tu historial.',
    index: false
  }
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private readonly router: Router,
    private readonly title: Title,
    private readonly meta: Meta,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  initialize(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.update(event.urlAfterRedirects));

    this.update(this.router.url);
  }

  private update(url: string): void {
    const path = url.split('?')[0].split('#')[0] || '/';
    const isPrivate = path.startsWith('/dashboard/') || path.startsWith('/recuperar-clave');
    const page = PAGE_SEO[path] || { ...DEFAULT_PAGE, index: !isPrivate };
    const canonicalUrl = `${SITE_URL}${path === '/' ? '' : path}`;

    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ name: 'robots', content: page.index === false || isPrivate ? 'noindex, nofollow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:site_name', content: 'CotizApp' });
    this.meta.updateTag({ property: 'og:locale', content: 'es_CL' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });

    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }
}