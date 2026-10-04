import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ProductDetailView } from '../models/app.models';
import { productPath } from '../utils/product-url.util';

interface SeoPage {
  title: string;
  description: string;
  index?: boolean;
}

const SITE_URL = 'https://cotizapp-d71c8.web.app';
const STRUCTURED_DATA_ID = 'cotizapp-page-structured-data';
const DEFAULT_PAGE: SeoPage = {
  title: 'CotizApp | Compara precios de materiales de construcción',
  description: 'Compara precios y stock de materiales entre ferreterías y arma tu cotización de obra en minutos.'
};

const PAGE_SEO: Record<string, SeoPage> = {
  '/': DEFAULT_PAGE,
  '/buscar': {
    title: 'Buscar materiales y comparar precios | CotizApp',
    description: 'Busca materiales de construcción y compara precios y disponibilidad entre ferreterías activas sin crear una cuenta.'
  },
  '/producto': {
    title: 'Comparar precios de productos | CotizApp',
    description: 'Revisa precios, stock y alternativas disponibles para tus materiales de construcción.'
  },
  '/maestros': {
    title: 'Cotizaciones para maestros y contratistas | CotizApp',
    description: 'Compara materiales, optimiza costos y guarda cotizaciones para cada proyecto de construcción.'
  },
  '/ferreterias': {
    title: 'CotizApp para ferreterías | Solicita acceso',
    description: 'Publica tu catálogo, precio y stock para participar en las comparaciones de maestros y contratistas.'
  },
  '/contacto': {
    title: 'Contacto y solicitud de acceso | CotizApp',
    description: 'Contacta a CotizApp para soporte o para solicitar acceso como ferretería.'
  },
  '/preguntas-frecuentes': {
    title: 'Preguntas frecuentes | CotizApp',
    description: 'Resuelve dudas sobre búsqueda de productos, cotizaciones, cuentas de maestro y acceso para ferreterías.'
  },
  '/terminos-condiciones': {
    title: 'Términos y condiciones | CotizApp',
    description: 'Condiciones de uso de CotizApp para visitantes, maestros y ferreterías.'
  },
  '/privacidad': {
    title: 'Política de privacidad | CotizApp',
    description: 'Conoce cómo CotizApp trata y protege los datos personales de sus usuarios.'
  },
  '/propiedad-intelectual': {
    title: 'Propiedad intelectual y denuncia de contenido | CotizApp',
    description: 'Consulta la política de propiedad intelectual de CotizApp y denuncia imágenes, marcas, fichas o descripciones presuntamente infractoras.'
  },
  '/desuscribir': {
    title: 'Dejar de recibir publicidad | CotizApp',
    description: 'Retira tu autorización para comunicaciones publicitarias de CotizApp.',
    index: false
  },
  '/reportar-precio': {
    title: 'Reportar un precio incorrecto | CotizApp',
    description: 'Informa una diferencia para que CotizApp verifique y corrija el precio publicado.',
    index: false
  },
  '/login': {
    title: 'Iniciar sesión | CotizApp',
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
      .subscribe((event) => this.updateRoute(event.urlAfterRedirects));

    this.updateRoute(this.router.url);
  }

  updateProduct(product: ProductDetailView): void {
    const path = productPath(product.productName);
    const description = this.productDescription(product);
    const image = this.validImage(product.imageUrl) ? product.imageUrl : undefined;
    const page: SeoPage = {
      title: `${product.productName}: precios en ferreterías | CotizApp`,
      index: !product.isDemo,
      description
    };

    this.applyPage(page, path, 'product', image);
    this.setStructuredData({
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Product',
        name: product.productName,
        image: image ? [image] : undefined,
        description,
        sku: product.sku || undefined,
        brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
        category: [product.categoryName, product.subcategoryName, product.familyName].filter(Boolean).join(' > '),
        offers: product.stores.length > 0 ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'CLP',
          lowPrice: Math.min(...product.stores.map((store) => store.price)),
          highPrice: Math.max(...product.stores.map((store) => store.price)),
          offerCount: product.stores.length,
          url: `${SITE_URL}${path}`
        } : undefined
      }, {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Productos', item: `${SITE_URL}/buscar` },
          { '@type': 'ListItem', position: 3, name: product.productName, item: `${SITE_URL}${path}` }
        ]
      }]
    });
  }

  markProductNotFound(): void {
    this.applyPage({
      title: 'Producto no encontrado | CotizApp',
      description: 'El producto solicitado no está disponible en el catálogo de CotizApp.',
      index: false
    }, this.router.url.split('?')[0] || '/producto');
  }

  private updateRoute(url: string): void {
    const path = url.split('?')[0].split('#')[0] || '/';
    const isPrivate = path.startsWith('/dashboard/') || path.startsWith('/cuenta/') || path.startsWith('/recuperar-clave');
    const isProduct = path.startsWith('/productos/');
    const page = PAGE_SEO[path]
      || (isProduct ? PAGE_SEO['/producto'] : undefined)
      || { ...DEFAULT_PAGE, index: false };

    this.applyPage(page, path, 'website', undefined, isPrivate);
    this.removeStructuredData();
  }

  private applyPage(
    page: SeoPage,
    canonicalPath: string,
    openGraphType = 'website',
    image?: string,
    forcePrivate = false
  ): void {
    image = image || `${SITE_URL}/assets/home-hero-construction.webp`;
    const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '' : canonicalPath}`;
    const shouldIndex = page.index !== false && !forcePrivate;

    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ name: 'robots', content: shouldIndex ? 'index, follow' : 'noindex, nofollow' });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:type', content: openGraphType });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:site_name', content: 'CotizApp' });
    this.meta.updateTag({ property: 'og:locale', content: 'es_CL' });
    this.meta.updateTag({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });

    if (image) {
      this.meta.updateTag({ property: 'og:image', content: image });
      this.meta.updateTag({ property: 'og:image:alt', content: page.title });
      this.meta.updateTag({ name: 'twitter:image', content: image });
    } else {
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('property="og:image:alt"');
      this.meta.removeTag('name="twitter:image"');
    }

    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }

  private productDescription(product: ProductDetailView): string {
    const source = product.shortDescription || product.description || product.productType;
    const comparison = `Compara precios de ${product.productName} en ${product.stores.length} ferretería${product.stores.length === 1 ? '' : 's'} de Chile.`;
    const text = source?.trim() ? `${source.trim()} ${comparison}` : comparison;
    return text.length > 160 ? `${text.slice(0, 157).trimEnd()}...` : text;
  }

  private validImage(value: string): boolean {
    return !!value && !value.includes('via.placeholder.com');
  }

  private setStructuredData(value: Record<string, unknown>): void {
    this.removeStructuredData();
    const script = this.document.createElement('script');
    script.id = STRUCTURED_DATA_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(value).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }

  private removeStructuredData(): void {
    this.document.getElementById(STRUCTURED_DATA_ID)?.remove();
  }
}
