import { ProjectQuotationView, SearchProximity } from '../models/app.models';

export interface QuotationPdfInput {
  projectName: string;
  projectAddress?: string;
  maestroName: string;
  quotation: ProjectQuotationView;
  proximity?: SearchProximity;
  exportedAt?: Date;
}

export function buildQuotationPdfFile(input: QuotationPdfInput): File {
  const exportedAt = input.exportedAt || new Date();
  const lines = buildQuotationPdfLines(input, exportedAt);
  const blob = buildPdfBlob(lines);
  const filename = `${toFileSafeName(input.projectName || 'cotizacion')}-${buildFilenameDate(exportedAt)}.pdf`;
  return new File([blob], filename, { type: 'application/pdf' });
}

export async function shareQuotationPdf(input: QuotationPdfInput): Promise<'shared' | 'downloaded'> {
  const file = buildQuotationPdfFile(input);
  const shareData: ShareData = {
    title: `Cotizacion - ${input.projectName || 'CotizApp'}`,
    text: `Cotizacion de materiales ${input.projectName ? `- ${input.projectName}` : ''}`,
    files: [file]
  };

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
        return 'shared';
      }
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  downloadFile(file);
  return 'downloaded';
}

export function downloadQuotationPdf(input: QuotationPdfInput): void {
  downloadFile(buildQuotationPdfFile(input));
}

function buildQuotationPdfLines(input: QuotationPdfInput, exportedAt: Date): string[] {
  const lines: string[] = [];
  const netTotal = input.quotation.optimalTotal;
  const ivaAmount = Math.round(netTotal * 0.19);
  const totalWithIva = netTotal + ivaAmount;

  lines.push('COTIZACION DE MATERIALES');
  lines.push(`Proyecto: ${input.projectName || 'Sin titulo'}`);
  lines.push(`Maestro: ${input.maestroName || 'No definido'}`);
  lines.push(`Fecha de exportacion: ${formatExportDate(exportedAt)}`);
  lines.push(`Direccion de obra: ${input.projectAddress?.trim() || 'Sin direccion de obra'}`);
  lines.push(
    input.proximity
      ? `Busqueda por cercania: hasta ${input.proximity.radiusKm} km desde la ubicacion del maestro`
      : 'Busqueda por cercania: todas las ferreterias'
  );
  lines.push(
    input.quotation.appliedStoreName
      ? `Estrategia de compra: todo en ${input.quotation.appliedStoreName}`
      : 'Estrategia de compra: compra combinada'
  );
  lines.push('');
  lines.push('DETALLE DE ARTICULOS');

  input.quotation.lines.forEach((line, index) => {
    lines.push(`${index + 1}. ${line.productName}`);
    lines.push(`Cantidad: ${line.quantity}`);
    lines.push(`Mejor tienda: ${line.bestStoreName}`);
    lines.push(`Precio unitario: ${formatCurrency(line.unitPrice)}`);
    lines.push(`Subtotal: ${formatCurrency(line.subtotal)}`);
    lines.push('');
  });

  lines.push('RESUMEN DE COTIZACION');
  lines.push(`Total neto: ${formatCurrency(netTotal)}`);
  lines.push(`IVA (19%): ${formatCurrency(ivaAmount)}`);
  lines.push(`Total con IVA: ${formatCurrency(totalWithIva)}`);
  lines.push(`Ahorro estimado: ${formatCurrency(input.quotation.mixedSaving)}`);
  lines.push(`Mejor tienda global: ${input.quotation.bestStore.storeName}`);
  lines.push(`Total tienda global: ${formatCurrency(input.quotation.bestStore.total)}`);
  lines.push('');
  lines.push('TOTALES POR FERRETERIA');

  input.quotation.totalsByStore.forEach((storeRow) => {
    lines.push(`${storeRow.storeName}: ${formatCurrency(storeRow.total)}`);
  });

  lines.push('');
  lines.push('Documento generado por CotizApp.');

  return lines.flatMap((line) => wrapLine(line, 95));
}

function buildPdfBlob(lines: string[]): Blob {
  const pageChunks = chunkLines(lines, 50);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');

  pageChunks.forEach((pageLines, index) => {
    const pageObjectId = 3 + (index * 2);
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);

    const pageContent = buildPdfPageContent(pageLines);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${3 + (pageChunks.length * 2)} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.push(`<< /Length ${pageContent.length} >>\nstream\n${pageContent}\nendstream`);
  });

  const fontObjectId = 3 + (pageChunks.length * 2);
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let documentContent = '%PDF-1.4\n';
  const objectOffsets: number[] = new Array(fontObjectId + 1).fill(0);

  objects.forEach((objectValue, index) => {
    const objectId = index + 1;
    objectOffsets[objectId] = documentContent.length;
    documentContent += `${objectId} 0 obj\n${objectValue}\nendobj\n`;
  });

  const xrefStart = documentContent.length;
  documentContent += `xref\n0 ${objects.length + 1}\n`;
  documentContent += '0000000000 65535 f \n';
  objectOffsets.slice(1, objects.length + 1).forEach((offset) => {
    documentContent += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });

  documentContent += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([documentContent], { type: 'application/pdf' });
}

function buildPdfPageContent(lines: string[]): string {
  const escapedLines = lines.map(escapePdfText);
  const commands: string[] = ['BT', '/F1 11 Tf', '14 TL', '40 800 Td'];

  escapedLines.forEach((line, index) => {
    if (index > 0) commands.push('T*');
    commands.push(`(${line}) Tj`);
  });

  commands.push('ET');
  return commands.join('\n');
}

function escapePdfText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(value: string, maxLength: number): string[] {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const wrapped: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) {
      current = candidate;
      return;
    }

    if (current) wrapped.push(current);

    if (word.length <= maxLength) {
      current = word;
      return;
    }

    let overflow = word;
    while (overflow.length > maxLength) {
      wrapped.push(`${overflow.slice(0, maxLength - 1)}-`);
      overflow = overflow.slice(maxLength - 1);
    }
    current = overflow;
  });

  if (current) wrapped.push(current);
  return wrapped;
}

function chunkLines(lines: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += chunkSize) {
    chunks.push(lines.slice(index, index + chunkSize));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatExportDate(value: Date): string {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function buildFilenameDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

function toFileSafeName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'cotizacion';
}

function downloadFile(file: File): void {
  const url = window.URL.createObjectURL(file);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.URL.revokeObjectURL(url);
}
