export const MAX_OFFER_PHOTOS = 12;
export interface OfferPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  storagePath: string;
  thumbnailPath: string;
  uploadedAt: string;
  uploadedBy: string;
}
export function publicOfferPhotos(value: unknown): Array<Pick<OfferPhoto, 'id' | 'url' | 'thumbnailUrl'>> {
  if (!Array.isArray(value)) return [];
  return value.filter(p => p && typeof p.id === 'string' && /^https:\/\//.test(p.url) && /^https:\/\//.test(p.thumbnailUrl))
    .slice(0, MAX_OFFER_PHOTOS).map(p => ({id:p.id,url:p.url,thumbnailUrl:p.thumbnailUrl}));
}

export function attributedOfferPhotos(offers: any[], visibleRows: any[], now=Date.now()) {
  const visible=new Map(visibleRows.map(row=>[row.productoFerreteriaId,row]));
  return offers.filter(offer=>visible.has(offer.id)&&offer.activo!==false&&offer.publicado!==false
    &&(!offer.vigenteDesde||Date.parse(offer.vigenteDesde)<=now)&&(!offer.vigenteHasta||Date.parse(offer.vigenteHasta)>now))
    .flatMap(offer=>{
      const source=visible.get(offer.id)!;
      return publicOfferPhotos(offer.fotosPublicacion).map(photo=>({...photo,storeId:source.storeId,storeName:source.storeName,offerId:offer.id,condition:offer.condicion||'sin_especificar',pilot:source.storePilot===true}));
    }).sort((a,b)=>a.storeName.localeCompare(b.storeName,'es'));
}
