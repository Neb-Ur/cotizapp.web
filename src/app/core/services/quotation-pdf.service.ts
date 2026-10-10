import { Injectable } from '@angular/core';
import { downloadQuotationPdf, shareQuotationPdf } from '../utils/quotation-pdf.util';
@Injectable({ providedIn: 'root' })
export class QuotationPdfService {
  download(input: Parameters<typeof downloadQuotationPdf>[0]): void { downloadQuotationPdf(input); }
  share(input: Parameters<typeof shareQuotationPdf>[0]): ReturnType<typeof shareQuotationPdf> { return shareQuotationPdf(input); }
}
