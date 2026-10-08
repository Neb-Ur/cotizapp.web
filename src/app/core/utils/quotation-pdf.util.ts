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
  if (!input.quotation.lines.length || input.quotation.lines.some(line => line.unitPrice <= 0)) throw new Error('Revisa los productos sin oferta disponible antes de exportar.');
  const exportedAt = input.exportedAt || new Date();
  const lines = buildQuotationPdfLines(input, exportedAt);
  const blob = buildPdfBlob(lines);
  const filename = `${toFileSafeName(input.projectName || 'cotizacion')}-${buildFilenameDate(exportedAt)}.pdf`;
  return new File([blob], filename, { type: 'application/pdf' });
}

export async function shareQuotationPdf(input: QuotationPdfInput): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = buildQuotationPdfFile(input);
  const shareData: ShareData = {
    title: `Cotizacion - ${input.projectName || 'Findi'}`,
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
        return 'cancelled';
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
  const totalWithIva = input.quotation.optimalTotal;

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
  lines.push(`Total final (IVA incluido): ${formatCurrency(totalWithIva)}`);
  lines.push(`Ahorro estimado: ${formatCurrency(input.quotation.mixedSaving)}`);
  lines.push(`Mejor tienda global: ${input.quotation.bestStore.storeName}`);
  lines.push(`Total tienda global: ${formatCurrency(input.quotation.bestStore.total)}`);
  lines.push('');
  lines.push('TOTALES POR FERRETERIA');

  input.quotation.totalsByStore.forEach((storeRow) => {
    lines.push(`${storeRow.storeName}: ${formatCurrency(storeRow.total)}`);
  });

  lines.push('');
  lines.push('Precios finales con IVA incluido, informados por las ferreterias.');
  lines.push('Cotizacion referencial: stock y precios sujetos a confirmacion. Despacho no incluido.');
  lines.push('Esta cotizacion no constituye una compra, un pedido ni una reserva de productos.');
  lines.push('La compra se realiza directamente con cada ferreteria.');
  lines.push('Documento generado por Findi.');

  return lines.flatMap((line) => wrapLine(line, 95));
}

function buildPdfBlob(lines: string[]): Blob {
  const pageChunks = chunkLines(lines, 44);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');

  pageChunks.forEach((pageLines, index) => {
    const pageObjectId = 3 + (index * 2);
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);

    const pageContent = buildPdfPageContent(pageLines, index + 1, pageChunks.length);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${3 + (pageChunks.length * 2)} 0 R /F2 ${4 + (pageChunks.length * 2)} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.push(`<< /Length ${pageContent.length} >>\nstream\n${pageContent}\nendstream`);
  });

  const fontObjectId = 3 + (pageChunks.length * 2);
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  let documentContent = '%PDF-1.4\n';
  const objectOffsets: number[] = new Array(fontObjectId + 2).fill(0);

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

function buildPdfPageContent(lines: string[], pageNumber: number, pageCount: number): string {
  const navy = '0.059 0.176 0.290';
  const orange = '1 0.478 0';
  const gray = '0.420 0.447 0.502';
  const commands: string[] = [
    'q', `${navy} rg`, roundedPdfRect(32, 754, 531, 64, 16), 'f',
    // Vector Findi mark: F and magnifying glass, with no external images or fonts.
    '1 1 1 RG 8 w 1 J', '48 767 m 48 786 l 48 795 53 799 61 799 c 75 799 l S',
    `${orange} RG 4 w`, '66 789 m 71 789 75 785 75 780 c 75 775 71 771 66 771 c 61 771 57 775 57 780 c 57 785 61 789 66 789 c S',
    '73 773 m 80 766 l S',
    'BT /F2 26 Tf 1 1 1 rg 94 783 Td (findi) Tj ET',
    'BT /F1 9 Tf 1 1 1 rg 95 767 Td (Encontrar. Comparar. Construir mejor.) Tj ET',
    'Q'
  ];

  lines.forEach((line, index) => {
    const y = 727 - index * 14;
    const heading = ['COTIZACION DE MATERIALES', 'DETALLE DE ARTICULOS', 'RESUMEN DE COTIZACION', 'TOTALES POR FERRETERIA'].includes(line);
    const total = line.startsWith('Total final (IVA incluido):');
    if (total) commands.push('q 1 0.950 0.890 rg', roundedPdfRect(39, y - 5, 517, 20, 5), 'f Q');
    commands.push(`BT /${heading || total ? 'F2' : 'F1'} ${heading ? 11 : 10} Tf ${heading || total ? navy : gray} rg 44 ${y} Td (${escapePdfText(line)}) Tj ET`);
  });

  commands.push(
    'q 0.86 0.89 0.92 RG 0.5 w 40 60 m 555 60 l S Q',
    `BT /F1 8 Tf ${gray} rg 44 42 Td (Findi - Cotizacion referencial. Compra directamente en la ferreteria.) Tj ET`,
    `BT /F1 8 Tf ${gray} rg 485 42 Td (Pagina ${pageNumber} / ${pageCount}) Tj ET`
  );
  return commands.join('\n');
}

function roundedPdfRect(x: number, y: number, width: number, height: number, radius: number): string {
  const k = radius * 0.55228475;
  const right = x + width;
  const top = y + height;
  return `${x + radius} ${y} m ${right - radius} ${y} l ` +
    `${right - radius + k} ${y} ${right} ${y + radius - k} ${right} ${y + radius} c ` +
    `${right} ${top - radius} l ${right} ${top - radius + k} ${right - radius + k} ${top} ${right - radius} ${top} c ` +
    `${x + radius} ${top} l ${x + radius - k} ${top} ${x} ${top - radius + k} ${x} ${top - radius} c ` +
    `${x} ${y + radius} l ${x} ${y + radius - k} ${x + radius - k} ${y} ${x + radius} ${y} c h`;
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
  let page: string[] = [];
  let block: string[] = [];
  const appendBlock = () => {
    if (!block.length) return;
    if (page.length && page.length + block.length > chunkSize) {
      chunks.push(page);
      page = [];
    }
    while (block.length > chunkSize) {
      chunks.push(block.splice(0, chunkSize));
    }
    page.push(...block);
    block = [];
  };
  for (const line of lines) {
    block.push(line);
    if (!line) appendBlock();
  }
  appendBlock();
  if (page.length) chunks.push(page);
  return chunks.length ? chunks : [[]];
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
