import {Router} from 'express';
import {defineSecret} from 'firebase-functions/params';
import {requireAuth,requireRole} from '../lib/auth.js';
import {fail,ok} from '../lib/http.js';
import {sqlPool} from '../database/pool.js';
import {useSqlDatabase} from '../database/config.js';
import {recordUniqueVisit,adminVisitDashboard} from '../services/visit-analytics.service.js';
export const visitAnalyticsKey=defineSecret('FINDI_VISIT_ANALYTICS_KEY');
export const visitAnalyticsRouter=Router();
visitAnalyticsRouter.post('/analytics/visit',async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.body?.analyticsConsent!==true || req.body?.consentVersion!==3) return fail(res,'ANALYTICS_CONSENT_REQUIRED','Debes permitir la analítica opcional.',400);
 if(!useSqlDatabase())return fail(res,'ANALYTICS_UNAVAILABLE','La analítica no está disponible.',503);
 const recorded=await recordUniqueVisit(await sqlPool(),req.ip || '',visitAnalyticsKey.value());
 return ok(res,{recorded});
});
visitAnalyticsRouter.get('/admin/dashboard',requireAuth,requireRole('admin'),async(_req,res)=>{
 res.set('Cache-Control','private, no-store');
 if(!useSqlDatabase())return fail(res,'ANALYTICS_UNAVAILABLE','Las métricas no están disponibles.',503);
 return ok(res,await adminVisitDashboard(await sqlPool()));
});
