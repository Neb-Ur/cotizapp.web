-- Reference roles for API-only access. Never give these credentials to browsers.
-- The deployment owner must be separate from the API service account.
BEGIN;
SET search_path=findi,pg_catalog;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='findi_api') THEN CREATE ROLE findi_api NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='findi_public_reader') THEN CREATE ROLE findi_public_reader NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA findi TO findi_api,findi_public_reader;
GRANT SELECT ON public_products,public_offers TO findi_public_reader;
CREATE FUNCTION current_user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('findi.user_id',true),'') $$;
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=findi,pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM users WHERE id=current_user_id() AND role='admin' AND account_status='activo');
$$;
CREATE FUNCTION owns_store(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=findi,pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM stores WHERE id=target AND owner_id=current_user_id());
$$;
CREATE FUNCTION owns_quotation(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=findi,pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM quotations WHERE id=target AND owner_id=current_user_id());
$$;
REVOKE ALL ON FUNCTION current_user_id(),is_admin(),owns_store(text),owns_quotation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_id(),is_admin(),owns_store(text),owns_quotation(text) TO findi_api;
-- Admin access is derived from the SQL profile, not a browser-supplied role string.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','stores','account_preferences','offers','product_requests','quotations','quotation_items',
 'consent_events','store_agreements','contact_messages','privacy_requests','ip_reports','ip_report_events','price_reports',
 'offer_history','admin_audit_logs','security_incidents','governance_evidence','store_event_counters','store_daily_analytics',
 'store_daily_top_products','content_rights','account_deletion_jobs','deletion_receipts','marketing_suppressions','job_runs',
 'import_batches','import_rows'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY admin_access ON %I TO findi_api USING(is_admin()) WITH CHECK(is_admin())',t);
 END LOOP;
END $$;
CREATE POLICY self_profile ON users FOR SELECT TO findi_api USING(id=current_user_id());
CREATE POLICY own_stores ON stores FOR SELECT TO findi_api USING(owner_id=current_user_id());
CREATE POLICY own_preferences ON account_preferences TO findi_api USING(user_id=current_user_id()) WITH CHECK(user_id=current_user_id() AND (primary_store_id IS NULL OR owns_store(primary_store_id)));
CREATE POLICY own_quotes ON quotations TO findi_api USING(owner_id=current_user_id()) WITH CHECK(owner_id=current_user_id());
CREATE POLICY own_items ON quotation_items TO findi_api USING(owns_quotation(quotation_id)) WITH CHECK(owns_quotation(quotation_id));
CREATE POLICY own_offers ON offers TO findi_api USING(owns_store(store_id)) WITH CHECK(owns_store(store_id));
CREATE POLICY own_product_requests ON product_requests FOR SELECT TO findi_api USING(owns_store(store_id));
CREATE POLICY own_consent_events ON consent_events FOR SELECT TO findi_api USING(user_id=current_user_id());
CREATE POLICY own_privacy_requests ON privacy_requests FOR SELECT TO findi_api USING(user_id=current_user_id());
CREATE POLICY own_agreements ON store_agreements FOR SELECT TO findi_api USING(owns_store(store_id));
CREATE POLICY own_daily ON store_daily_analytics FOR SELECT TO findi_api USING(owns_store(store_id));
CREATE POLICY own_daily_top ON store_daily_top_products FOR SELECT TO findi_api USING(owns_store(store_id));
CREATE POLICY own_counters ON store_event_counters FOR SELECT TO findi_api USING(owns_store(store_id));
GRANT SELECT ON users,stores,account_preferences,offers,product_requests,quotations,quotation_items,consent_events,privacy_requests,store_agreements,store_daily_analytics,store_daily_top_products,store_event_counters TO findi_api;
GRANT SELECT ON latest_store_analytics TO findi_api;
GRANT INSERT,UPDATE,DELETE ON quotations,quotation_items,account_preferences TO findi_api;
-- API services for catalog, registration, legal acceptance, moderation, privacy and anonymous forms
-- require dedicated transactional functions or a tightly restricted private service connection.
-- No blanket UPDATE on users: that would let an account grant itself admin privileges.
-- RLS is an extra isolation layer, NOT a substitute for current legal/account/role checks.
COMMIT;
