import { Router } from 'express';
import { requireAuth,requireRole } from '../lib/auth.js';
import { canAccessOwner } from '../lib/ownership.js';
import { row } from '../repositories/firestore.repository.js';
import { COLLECTIONS } from '../lib/collections.js';
import { fail,ok } from '../lib/http.js';
import { normalizeVerificationCode,storeVerificationView } from '../services/quotation-verification.service.js';
export const storeQuotationsRouter=Router();
storeQuotationsRouter.get('/ferreterias/:storeId/cotizaciones/:code',requireAuth,requireRole('ferreteria','admin'),async(req,res)=>{
 res.set('Cache-Control','private, no-store');
 const store=await row(COLLECTIONS.stores,req.params.storeId);
 if(!store||!canAccessOwner(req,store.usuarioDuenoId))return fail(res,'AUTH_FORBIDDEN','No tienes acceso a esta ferretería.',403);
 const code=normalizeVerificationCode(req.params.code);
 if(!code)return fail(res,'QUOTATION_CODE_INVALID','Revisa el código de cotización.',400);
 const record=await row(COLLECTIONS.quotationVerifications,code);
 const result=record&&storeVerificationView(record,store.id);
 if(!result)return fail(res,'QUOTATION_NOT_FOUND','No encontramos una cotización con ese código y productos cotizados con tu ferretería.',404);
 return ok(res,result);
});
