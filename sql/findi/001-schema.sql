-- Findi relational design, PostgreSQL 17+. NOT a production migration.
-- Apply once to an EMPTY disposable database; retain Firebase UID/document IDs.
BEGIN;
CREATE SCHEMA findi;
REVOKE ALL ON SCHEMA findi FROM PUBLIC;
SET search_path = findi, pg_catalog;
CREATE DOMAIN nonnegative_amount AS numeric CHECK (VALUE >= 0 AND VALUE::text NOT IN ('NaN','Infinity','-Infinity'));
CREATE DOMAIN positive_quantity AS numeric CHECK (VALUE > 0 AND VALUE::text NOT IN ('NaN','Infinity','-Infinity'));

CREATE TABLE users (
 id text PRIMARY KEY, -- exact Firebase Authentication UID; never a password
 role text NOT NULL CHECK(role IN ('maestro','ferreteria','admin')),
 name text NOT NULL, email text NOT NULL, phone text, region text, city text, commune text, address text,
 account_status text NOT NULL DEFAULT 'activo' CHECK(account_status IN ('activo','pendiente','inactivo','suspendido')),
 processing_blocked boolean NOT NULL DEFAULT false, blocked_at timestamptz, unblocked_at timestamptz,
 terms_version text, terms_accepted_at timestamptz, privacy_version text, privacy_informed_at timestamptz,
 age_confirmed boolean NOT NULL DEFAULT false, marketing_consent boolean NOT NULL DEFAULT false,
 marketing_updated_at timestamptz, quotation_limit integer NOT NULL DEFAULT 2 CHECK(quotation_limit>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users(lower(email));
CREATE TABLE stores (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 owner_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 business_name text NOT NULL, legal_name text, tax_id text, branch_name text,
 address text, region text, city text, commune text,
 public_email text, public_phone text,
 latitude numeric CHECK(latitude BETWEEN -90 AND 90), longitude numeric CHECK(longitude BETWEEN -180 AND 180),
 status text NOT NULL DEFAULT 'activo' CHECK(status IN ('activo','inactivo')),
 agreement_status text NOT NULL DEFAULT 'pendiente' CHECK(agreement_status IN ('pendiente','vigente','suspendido','terminado')),
 agreement_version text, agreement_document_hash text, agreement_accepted_at timestamptz, agreement_updated_at timestamptz,
 catalog_updated_at timestamptz, ip_status text, previous_ip_state jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), CHECK((latitude IS NULL)=(longitude IS NULL))
);
CREATE INDEX stores_owner ON stores(owner_id);
CREATE INDEX stores_coordinates ON stores(latitude,longitude) WHERE status='activo';
CREATE TABLE account_preferences (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 primary_store_id text REFERENCES stores(id) ON DELETE SET NULL,
 selected_quotation_id text, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(primary_store_id,user_id) REFERENCES stores(id,owner_id) DEFERRABLE INITIALLY DEFERRED
); -- optional cross-device preferences; localStorage behavior remains supported

CREATE TABLE categories (id text PRIMARY KEY DEFAULT gen_random_uuid()::text, name text NOT NULL, icon text NOT NULL DEFAULT 'box', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE subcategories (id text PRIMARY KEY DEFAULT gen_random_uuid()::text, category_id text NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, name text NOT NULL, UNIQUE(id,category_id));
CREATE TABLE families (id text PRIMARY KEY DEFAULT gen_random_uuid()::text, subcategory_id text NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT, name text NOT NULL);
CREATE INDEX subcategories_parent ON subcategories(category_id);
CREATE INDEX families_parent ON families(subcategory_id);
CREATE TABLE brands (id text PRIMARY KEY DEFAULT gen_random_uuid()::text, name text NOT NULL, normalized_name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE product_models (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, family_id text NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 name text NOT NULL, description text, UNIQUE(id,family_id)
); -- optional semantic parent; never manufacture missing variants
CREATE TABLE products (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, family_id text NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 model_id text, brand_id text REFERENCES brands(id) ON DELETE RESTRICT, legacy_brand_label text,
 name text NOT NULL, product_type text, catalog_level text NOT NULL DEFAULT 'tipo_base',
 sale_unit text, presentation text, barcode text,
 short_description text, long_description text,
 logistics_weight_kg nonnegative_amount, logistics_volume_m3 nonnegative_amount, units_per_pallet nonnegative_amount,
 status text NOT NULL DEFAULT 'activo' CHECK(status IN ('activo','inactivo')),
 source_kind text, source_reference text, source_batch text, ip_status text, deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,family_id), FOREIGN KEY(model_id,family_id) REFERENCES product_models(id,family_id) ON DELETE RESTRICT
);
CREATE INDEX products_family ON products(family_id,status);
CREATE INDEX products_brand ON products(brand_id,status);
CREATE INDEX products_barcode ON products(barcode) WHERE barcode IS NOT NULL AND barcode<>'';
-- Names/barcodes are NOT globally unique: different families and generic references can share them.
CREATE TABLE product_features (product_id text REFERENCES products(id) ON DELETE CASCADE, position integer NOT NULL CHECK(position>=0), text text NOT NULL, PRIMARY KEY(product_id,position));
CREATE TABLE attribute_definitions (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, family_id text NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 code text NOT NULL, label text NOT NULL, unit text,
 data_type text NOT NULL CHECK(data_type IN ('texto','numero','booleano','seleccion')),
 filterable boolean NOT NULL DEFAULT false, required boolean NOT NULL DEFAULT false, position integer NOT NULL DEFAULT 0,
 UNIQUE(id,family_id), UNIQUE(family_id,code)
);
CREATE TABLE attribute_options (
 definition_id text REFERENCES attribute_definitions(id) ON DELETE CASCADE,
 value text NOT NULL, label text, position integer NOT NULL DEFAULT 0, PRIMARY KEY(definition_id,value)
);
CREATE TABLE product_attributes (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 product_id text NOT NULL, family_id text NOT NULL, definition_id text NOT NULL,
 code_snapshot text, label_snapshot text,
 text_value text, numeric_value numeric, boolean_value boolean, option_value text,
 FOREIGN KEY(product_id,family_id) REFERENCES products(id,family_id) ON DELETE CASCADE,
 FOREIGN KEY(definition_id,family_id) REFERENCES attribute_definitions(id,family_id) ON DELETE RESTRICT,
 FOREIGN KEY(definition_id,option_value) REFERENCES attribute_options(definition_id,value) ON DELETE RESTRICT,
 CHECK(numeric_value IS NULL OR numeric_value::text NOT IN ('NaN','Infinity','-Infinity')),
 UNIQUE(product_id,definition_id), CHECK(num_nonnulls(text_value,numeric_value,boolean_value,option_value)=1)
);
CREATE INDEX product_attributes_number ON product_attributes(definition_id,numeric_value) WHERE numeric_value IS NOT NULL;
CREATE INDEX product_attributes_option ON product_attributes(definition_id,option_value) WHERE option_value IS NOT NULL;
CREATE FUNCTION check_attribute_type() RETURNS trigger LANGUAGE plpgsql SET search_path=findi,pg_catalog,pg_temp AS $$
DECLARE dtype text;
BEGIN
 SELECT data_type INTO dtype FROM attribute_definitions WHERE id=NEW.definition_id;
 IF (dtype='texto' AND NEW.text_value IS NULL) OR (dtype='numero' AND NEW.numeric_value IS NULL)
 OR (dtype='booleano' AND NEW.boolean_value IS NULL) OR (dtype='seleccion' AND NEW.option_value IS NULL)
 THEN RAISE EXCEPTION 'ATTRIBUTE_TYPE_MISMATCH' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER product_attribute_type BEFORE INSERT OR UPDATE ON product_attributes FOR EACH ROW EXECUTE FUNCTION check_attribute_type();
CREATE FUNCTION prevent_incompatible_attribute_type() RETURNS trigger LANGUAGE plpgsql SET search_path=findi,pg_catalog,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM product_attributes a WHERE a.definition_id=NEW.id AND
  ((NEW.data_type='texto' AND a.text_value IS NULL) OR (NEW.data_type='numero' AND a.numeric_value IS NULL)
   OR (NEW.data_type='booleano' AND a.boolean_value IS NULL) OR (NEW.data_type='seleccion' AND a.option_value IS NULL)))
 THEN RAISE EXCEPTION 'ATTRIBUTE_DEFINITION_REQUIRES_VALUE_MIGRATION' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER definition_type_change BEFORE UPDATE OF data_type ON attribute_definitions FOR EACH ROW EXECUTE FUNCTION prevent_incompatible_attribute_type();
-- Required-attribute completeness is an API rule for variants, not for generic bases.
CREATE TABLE content_rights (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, source_type text NOT NULL, provider text, source_url text,
 source_terms_url text, authorization_reference text NOT NULL, contains_third_party_marks boolean NOT NULL DEFAULT false,
 trademark_authorization_reference text, reviewed_by text REFERENCES users(id) ON DELETE SET NULL, reviewed_at timestamptz,
 legal_hold boolean NOT NULL DEFAULT false, retention_until timestamptz,
 CHECK(NOT contains_third_party_marks OR trademark_authorization_reference IS NOT NULL)
);
CREATE TABLE product_content_rights (
 product_id text PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
 rights_id text NOT NULL REFERENCES content_rights(id) ON DELETE RESTRICT
);
CREATE TABLE media_assets (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, url text NOT NULL, storage_path text, mime_type text,
 origin text NOT NULL, rights_id text REFERENCES content_rights(id) ON DELETE RESTRICT,
 generated_by text, generation_reference text, ai_disclosure text, alt_text text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE product_media (
 product_id text REFERENCES products(id) ON DELETE CASCADE, asset_id text REFERENCES media_assets(id) ON DELETE RESTRICT,
 position integer NOT NULL CHECK(position>=0), in_gallery boolean NOT NULL DEFAULT true, is_primary boolean NOT NULL DEFAULT false,
 PRIMARY KEY(product_id,asset_id), UNIQUE(product_id,position)
);
CREATE UNIQUE INDEX product_one_primary_image ON product_media(product_id) WHERE is_primary;

CREATE TABLE legal_documents (
 kind text NOT NULL, version text NOT NULL, document_hash text NOT NULL,
 content jsonb NOT NULL, effective_at timestamptz, is_current boolean NOT NULL DEFAULT false,
 PRIMARY KEY(kind,version,document_hash)
);
CREATE UNIQUE INDEX legal_one_current ON legal_documents(kind) WHERE is_current;
CREATE TABLE consent_events (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type text NOT NULL CHECK(type IN ('terms','privacy_notice','age_declaration','marketing')), version text NOT NULL,
 granted boolean NOT NULL, source text NOT NULL, occurred_at timestamptz NOT NULL,
 document_hash text, purpose text, express_consent boolean, evidence jsonb NOT NULL DEFAULT '{}'::jsonb
); -- append-only application permission; subject erasure is a distinct workflow
CREATE INDEX consent_user_time ON consent_events(user_id,occurred_at DESC);
CREATE TABLE store_agreements (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 store_id text REFERENCES stores(id) ON DELETE SET NULL, store_reference text NOT NULL,
 signer_user_id text REFERENCES users(id) ON DELETE SET NULL,
 version text NOT NULL, document_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('vigente','suspendido','terminado')),
 provider_snapshot jsonb NOT NULL, store_snapshot jsonb NOT NULL, signer_snapshot jsonb NOT NULL,
 declarations jsonb NOT NULL, evidence jsonb NOT NULL,
 accepted_at timestamptz NOT NULL, updated_at timestamptz, terminated_at timestamptz, termination_reason text,
 modified_by text REFERENCES users(id) ON DELETE SET NULL, legal_hold boolean NOT NULL DEFAULT false, delete_after timestamptz,
 document_kind text NOT NULL DEFAULT 'store_agreement' CHECK(document_kind='store_agreement'),
 FOREIGN KEY(document_kind,version,document_hash) REFERENCES legal_documents(kind,version,document_hash)
);
CREATE INDEX agreements_store_state ON store_agreements(store_id,status,accepted_at DESC);
CREATE TABLE offers (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 store_id text NOT NULL REFERENCES stores(id) ON DELETE RESTRICT, product_id text NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 store_sku text, barcode text, price nonnegative_amount NOT NULL, currency text NOT NULL DEFAULT 'CLP' CHECK(currency='CLP'),
 stock bigint NOT NULL DEFAULT 0 CHECK(stock>=0), includes_vat boolean NOT NULL DEFAULT true CHECK(includes_vat),
 measurement_unit text CHECK(measurement_unit IN ('kg','l','m','m2','m3','unidad')), measurement_quantity positive_quantity,
 measurement_source text CHECK(measurement_source IN ('store_reported','catalog_presentation')),
 valid_from timestamptz, valid_until timestamptz, conditions text,
 active boolean NOT NULL DEFAULT true, published boolean NOT NULL DEFAULT true, sponsored boolean NOT NULL DEFAULT false,
 withdrawal_reason text, ip_status text, previous_ip_state jsonb, ip_report_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,product_id), UNIQUE(id,store_id,product_id),
 CHECK(valid_until IS NULL OR valid_from IS NULL OR valid_until>=valid_from)
);
CREATE INDEX offers_product ON offers(product_id,price) WHERE active AND published;
CREATE INDEX offers_store ON offers(store_id,updated_at DESC);
CREATE TABLE product_requests (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 requester_id text REFERENCES users(id) ON DELETE SET NULL, admin_id text REFERENCES users(id) ON DELETE SET NULL,
 product_name text NOT NULL, barcode text, store_sku text, published boolean NOT NULL DEFAULT true,
 reference_quantity bigint CHECK(reference_quantity>=0), reference_price nonnegative_amount,
 status text NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aprobada','rechazada')),
 request_type text NOT NULL CHECK(request_type IN ('posible_match','nuevo_producto')),
 suggested_product_id text REFERENCES products(id) ON DELETE SET NULL,
 resulting_offer_id text REFERENCES offers(id) ON DELETE SET NULL,
 admin_notes text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE INDEX product_requests_status ON product_requests(status,created_at DESC);
CREATE TABLE quotations (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL, address text,
 proximity_latitude numeric CHECK(proximity_latitude BETWEEN -90 AND 90),
 proximity_longitude numeric CHECK(proximity_longitude BETWEEN -180 AND 180), proximity_radius_km positive_quantity,
 single_store_id text REFERENCES stores(id) ON DELETE SET NULL, single_store_name_snapshot text, single_store_reference text,
 status text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
 UNIQUE(id,owner_id),
 CHECK(num_nonnulls(proximity_latitude,proximity_longitude,proximity_radius_km) IN (0,3))
);
CREATE INDEX quotations_owner_date ON quotations(owner_id,created_at DESC);
CREATE INDEX quotations_activity ON quotations((COALESCE(updated_at,created_at)));
CREATE TABLE quotation_items (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, quotation_id text NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position>=0), product_id text REFERENCES products(id) ON DELETE SET NULL,
 product_name_snapshot text NOT NULL, quantity bigint NOT NULL CHECK(quantity>=1),
 selected_store_id text REFERENCES stores(id) ON DELETE SET NULL, selected_store_name_snapshot text,
 selected_offer_id text REFERENCES offers(id) ON DELETE SET NULL,
 product_reference text, store_reference text, offer_reference text,
 resolution_state text NOT NULL DEFAULT 'id' CHECK(resolution_state IN ('id','unique_name','ambiguous','unresolved')),
 UNIQUE(quotation_id,position)
); -- distinct line IDs preserve duplicates, order and stock grouping in the optimizer
CREATE FUNCTION check_item_offer_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=findi,pg_catalog,pg_temp AS $$
DECLARE offer_product text; offer_store text;
BEGIN
 IF NEW.selected_offer_id IS NOT NULL THEN
  SELECT product_id,store_id INTO offer_product,offer_store FROM offers WHERE id=NEW.selected_offer_id;
  IF (NEW.product_id IS NOT NULL AND NEW.product_id<>offer_product) OR
     (NEW.selected_store_id IS NOT NULL AND NEW.selected_store_id<>offer_store)
  THEN RAISE EXCEPTION 'QUOTATION_OFFER_IDENTITY_MISMATCH' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER quotation_offer_identity BEFORE INSERT OR UPDATE ON quotation_items FOR EACH ROW EXECUTE FUNCTION check_item_offer_identity();
CREATE INDEX quotation_items_product ON quotation_items(product_id);
CREATE INDEX quotation_items_store ON quotation_items(selected_store_id);
ALTER TABLE account_preferences ADD CONSTRAINT preferred_quotation_owned
 FOREIGN KEY(selected_quotation_id,user_id) REFERENCES quotations(id,owner_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
-- Clear a selected quotation in the same delete transaction, or delete its preferences first.
CREATE FUNCTION enforce_quotation_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=findi,pg_catalog,pg_temp AS $$
DECLARE allowed_count integer; actual_count integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.owner_id=OLD.owner_id THEN RETURN NEW; END IF;
 SELECT quotation_limit INTO allowed_count FROM users WHERE id=NEW.owner_id FOR UPDATE;
 SELECT count(*) INTO actual_count FROM quotations WHERE owner_id=NEW.owner_id AND id<>NEW.id;
 IF actual_count >= allowed_count THEN RAISE EXCEPTION 'COTIZACION_LIMIT_REACHED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER quotation_limit BEFORE INSERT OR UPDATE OF owner_id ON quotations FOR EACH ROW EXECUTE FUNCTION enforce_quotation_limit();

CREATE TABLE contact_messages (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id text REFERENCES users(id) ON DELETE SET NULL,
 type text NOT NULL CHECK(type IN ('maestro','ferreteria','otro','privacidad')), name text, email text, phone text, commune text,
 business_name text, message text NOT NULL, status text NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','contactado','cerrado')),
 privacy_consent jsonb NOT NULL, legal_acceptance jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE INDEX contacts_email ON contact_messages(lower(email));
CREATE TABLE marketing_suppressions (email_hash text PRIMARY KEY, hash_scheme text NOT NULL DEFAULT 'sha256-normalized-email-v1', suppressed_at timestamptz NOT NULL, source text NOT NULL);
CREATE TABLE privacy_requests (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id text REFERENCES users(id) ON DELETE SET NULL, email text,
 type text NOT NULL CHECK(type IN ('access','rectification','deletion','objection','blocking','portability')),
 details text, status text NOT NULL CHECK(status IN ('recibida','en_revision','completada','rechazada')),
 submitted_at timestamptz NOT NULL, acknowledged_at timestamptz, response_due_at timestamptz, blocking_due_at timestamptz,
 resolution text, resolved_at timestamptz, resolved_by text REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz,
 legal_hold boolean NOT NULL DEFAULT false, retention_until timestamptz
);
CREATE INDEX privacy_requests_user ON privacy_requests(user_id,submitted_at DESC);
CREATE TABLE deletion_receipts (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, completed_at timestamptz NOT NULL, counts jsonb NOT NULL,
 source text NOT NULL, retention_until timestamptz
); -- no account ID/email/raw payload belongs in this table
CREATE TABLE account_deletion_jobs (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id text, -- not FK: must survive profile deletion until Auth deletion succeeds
 status text NOT NULL CHECK(status IN ('pending','sql_minimized','auth_deleted','completed','failed')),
 auth_delete_confirmed_at timestamptz, completed_at timestamptz, attempts integer NOT NULL DEFAULT 0,
 requested_at timestamptz NOT NULL DEFAULT now(), last_error_code text, backup_erasure_expected_by timestamptz
); -- purge UID when complete; private operational saga, not a deletion receipt
CREATE TABLE ip_reports (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id text REFERENCES users(id) ON DELETE SET NULL,
 reference text NOT NULL UNIQUE, receipt_token_hash text,
 claimant_name text, claimant_email text, claimant_organization text, claimant_capacity text CHECK(claimant_capacity IN ('owner','authorized_agent')),
 rights_type text NOT NULL CHECK(rights_type IN ('copyright','trademark','both')),
 content_type text NOT NULL CHECK(content_type IN ('product_image','logo','technical_sheet','commercial_description','other')),
 target_type text NOT NULL CHECK(target_type IN ('store_offer','master_product','store','other')), target_reference text,
 product_id text REFERENCES products(id) ON DELETE SET NULL, offer_id text REFERENCES offers(id) ON DELETE SET NULL, store_id text REFERENCES stores(id) ON DELETE SET NULL,
 content_url text NOT NULL, original_work_url text, work_description text, infringement_description text,
 declarations jsonb NOT NULL, privacy_consent jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('recibida','en_revision','retiro_preventivo','esperando_respuesta','repuesto','retiro_definitivo','rechazada')), public_status_message text, assigned_to text REFERENCES users(id) ON DELETE SET NULL,
 submitted_at timestamptz NOT NULL, acknowledged_at timestamptz, initial_review_due_at timestamptz, target_resolution_at timestamptz,
 resolution text, resolved_at timestamptz, updated_at timestamptz, minimized_at timestamptz,
 legal_hold boolean NOT NULL DEFAULT false, retention_until timestamptz
);
CREATE TABLE ip_report_events (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, report_id text NOT NULL REFERENCES ip_reports(id) ON DELETE CASCADE,
 position integer NOT NULL, status text NOT NULL, occurred_at timestamptz NOT NULL,
 actor_user_id text REFERENCES users(id) ON DELETE SET NULL, actor_kind text, resolution text, UNIQUE(report_id,position)
);
ALTER TABLE products ADD COLUMN ip_report_id text REFERENCES ip_reports(id) ON DELETE SET NULL;
ALTER TABLE stores ADD COLUMN ip_report_id text REFERENCES ip_reports(id) ON DELETE SET NULL;
ALTER TABLE offers ADD CONSTRAINT offer_ip_report FOREIGN KEY(ip_report_id) REFERENCES ip_reports(id) ON DELETE SET NULL;
CREATE TABLE price_reports (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, reference text NOT NULL UNIQUE,
 user_id text REFERENCES users(id) ON DELETE SET NULL, email text,
 product_id text REFERENCES products(id) ON DELETE SET NULL, store_id text REFERENCES stores(id) ON DELETE SET NULL, offer_id text REFERENCES offers(id) ON DELETE SET NULL,
 product_name_snapshot text NOT NULL, store_name_snapshot text NOT NULL, store_reference text NOT NULL, offer_reference text NOT NULL,
 content_url text, displayed_price nonnegative_amount NOT NULL, catalog_price_at_report nonnegative_amount NOT NULL, observed_price nonnegative_amount NOT NULL,
 details text, privacy_consent jsonb NOT NULL, status text NOT NULL CHECK(status IN ('recibido','en_revision','corregido','no_acreditado')),
 resolution text, resolved_at timestamptz, resolved_by text REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz, minimized_at timestamptz, legal_hold boolean NOT NULL DEFAULT false, retention_until timestamptz
);
CREATE TABLE offer_history (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 offer_id text REFERENCES offers(id) ON DELETE SET NULL, store_id text REFERENCES stores(id) ON DELETE SET NULL, product_id text REFERENCES products(id) ON DELETE SET NULL,
 offer_reference text NOT NULL, store_reference text NOT NULL, product_reference text NOT NULL,
 actor_id text REFERENCES users(id) ON DELETE SET NULL, actor_account_deleted_at timestamptz,
 action text NOT NULL, source text NOT NULL, old_price nonnegative_amount, new_price nonnegative_amount,
 includes_vat boolean NOT NULL, before_snapshot jsonb, after_snapshot jsonb,
 product_request_id text REFERENCES product_requests(id) ON DELETE SET NULL, price_report_id text REFERENCES price_reports(id) ON DELETE SET NULL,
 occurred_at timestamptz NOT NULL, legal_hold boolean NOT NULL DEFAULT false, retention_until timestamptz
);
CREATE INDEX offer_history_offer_date ON offer_history(offer_reference,occurred_at DESC);
CREATE INDEX offer_history_store_date ON offer_history(store_reference,occurred_at DESC);
CREATE TABLE admin_audit_logs (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, actor_id text REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL, actor_role text, method text, path text, target_type text, target_reference text, status_code integer, outcome text, result_code text,
 details jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL, retention_until timestamptz
);
CREATE TABLE security_incidents (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, title text NOT NULL, description text,
 severity text NOT NULL CHECK(severity IN ('baja','media','alta','critica')), status text NOT NULL CHECK(status IN ('abierto','contenido','recuperado','cerrado')),
 detected_at timestamptz NOT NULL, systems text[], data_categories text[], affected_people_estimate bigint CHECK(affected_people_estimate>=0),
 reasonable_risk boolean, agency_notification_required boolean, containment_actions text, root_cause text, lessons_learned text,
 agency_notified_at timestamptz, subjects_notified_at timestamptz, closed_at timestamptz,
 created_by text REFERENCES users(id) ON DELETE SET NULL, updated_by text REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz, updated_at timestamptz, legal_hold boolean NOT NULL DEFAULT false, retention_until timestamptz
);
CREATE TABLE governance_evidence (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, type text NOT NULL, outcome text NOT NULL,
 title text NOT NULL, owner_label text NOT NULL, performed_at timestamptz NOT NULL, next_review_at timestamptz, notes text, evidence_url text,
 created_at timestamptz, created_by text REFERENCES users(id) ON DELETE SET NULL, legal_hold boolean NOT NULL DEFAULT false, retention_until timestamptz
);

CREATE TABLE store_event_counters (
 store_id text PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
 views bigint NOT NULL DEFAULT 0 CHECK(views>=0), selections bigint NOT NULL DEFAULT 0 CHECK(selections>=0), updated_at timestamptz
); -- aggregate anonymous counters; no visitors, IPs, cookies or quotation owners
CREATE TABLE job_runs (
 job_name text NOT NULL, local_date date NOT NULL, time_zone text NOT NULL DEFAULT 'America/Santiago',
 status text NOT NULL CHECK(status IN ('running','complete','failed')), started_at timestamptz NOT NULL, completed_at timestamptz, failed_at timestamptz,
 error_code text, stores_processed integer CHECK(stores_processed>=0), PRIMARY KEY(job_name,local_date)
);
CREATE TABLE store_daily_analytics (
 store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE, local_date date NOT NULL,
 schema_version integer NOT NULL DEFAULT 1, computed_at timestamptz NOT NULL, active_window_days integer NOT NULL DEFAULT 30,
 quotation_count bigint NOT NULL DEFAULT 0, quoted_lines bigint NOT NULL DEFAULT 0, quoted_units bigint NOT NULL DEFAULT 0, quoted_products bigint NOT NULL DEFAULT 0,
 active_quotation_count bigint NOT NULL DEFAULT 0, active_quoted_units bigint NOT NULL DEFAULT 0, active_quoted_amount nonnegative_amount NOT NULL DEFAULT 0,
 recent_quotation_count bigint NOT NULL DEFAULT 0, previous_quotation_count bigint NOT NULL DEFAULT 0,
 views bigint NOT NULL DEFAULT 0, selections bigint NOT NULL DEFAULT 0,
 catalog_total bigint NOT NULL DEFAULT 0, catalog_published bigint NOT NULL DEFAULT 0, catalog_in_stock bigint NOT NULL DEFAULT 0,
 catalog_out_of_stock bigint NOT NULL DEFAULT 0, catalog_stale_prices bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(store_id,local_date)
);
CREATE TABLE store_daily_top_products (
 store_id text NOT NULL, local_date date NOT NULL, rank integer NOT NULL CHECK(rank BETWEEN 1 AND 20),
 product_id text REFERENCES products(id) ON DELETE SET NULL, product_reference text NOT NULL, product_name_snapshot text NOT NULL,
 quotation_count bigint NOT NULL, units bigint NOT NULL, active_amount nonnegative_amount NOT NULL, stock bigint NOT NULL,
 PRIMARY KEY(store_id,local_date,rank), FOREIGN KEY(store_id,local_date) REFERENCES store_daily_analytics(store_id,local_date) ON DELETE CASCADE
);
CREATE INDEX daily_analytics_latest ON store_daily_analytics(store_id,computed_at DESC);
CREATE TABLE catalog_revisions (
 scope text PRIMARY KEY CHECK(scope IN ('static','offers')), revision bigint NOT NULL DEFAULT 0,
 changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO catalog_revisions(scope) VALUES('static'),('offers');
CREATE TABLE public_cache_artifacts (
 key text PRIMARY KEY, scope text NOT NULL REFERENCES catalog_revisions(scope), version text NOT NULL,
 object_path text, payload jsonb, schema_version integer NOT NULL, updated_at timestamptz NOT NULL, expires_at timestamptz,
 CHECK(object_path IS NOT NULL OR payload IS NOT NULL)
); -- public allowlisted derivatives only, never source-of-truth
CREATE TABLE outbox_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, topic text NOT NULL, entity_type text, entity_reference text,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, last_error_code text
);
CREATE INDEX outbox_pending ON outbox_events(id) WHERE processed_at IS NULL;
CREATE TABLE seo_routes (
 path text PRIMARY KEY CHECK(path LIKE '/%' AND path NOT LIKE '//%'),
 product_id text REFERENCES products(id) ON DELETE RESTRICT, category_id text REFERENCES categories(id) ON DELETE RESTRICT,
 family_id text REFERENCES families(id) ON DELETE RESTRICT, brand_id text REFERENCES brands(id) ON DELETE RESTRICT,
 canonical_path text REFERENCES seo_routes(path) DEFERRABLE INITIALLY DEFERRED,
 is_canonical boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT true,
 title_override text, description_override text, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(product_id,category_id,family_id,brand_id)=1),
 CHECK((is_canonical AND canonical_path IS NULL) OR (NOT is_canonical AND canonical_path IS NOT NULL AND canonical_path<>path))
);
CREATE UNIQUE INDEX seo_one_product_canonical ON seo_routes(product_id) WHERE is_canonical;
CREATE UNIQUE INDEX seo_one_category_canonical ON seo_routes(category_id) WHERE is_canonical;
CREATE UNIQUE INDEX seo_one_family_canonical ON seo_routes(family_id) WHERE is_canonical;
CREATE UNIQUE INDEX seo_one_brand_canonical ON seo_routes(brand_id) WHERE is_canonical;
CREATE TABLE catalog_search_documents (
 product_id text PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
 normalized_text text NOT NULL, search_vector tsvector NOT NULL, version bigint NOT NULL, updated_at timestamptz NOT NULL
);
CREATE INDEX search_documents_gin ON catalog_search_documents USING gin(search_vector);
-- Index generated by the worker with the SAME accent/unit/token normalization as current JS.

CREATE INDEX product_requests_store ON product_requests(store_id,created_at DESC);
CREATE INDEX privacy_requests_due ON privacy_requests(status,response_due_at);
CREATE INDEX ip_reports_claimant_email ON ip_reports(lower(claimant_email));
CREATE INDEX ip_reports_target ON ip_reports(target_type,target_reference);
CREATE INDEX price_reports_email ON price_reports(lower(email));
CREATE INDEX price_reports_status ON price_reports(status,created_at DESC);
CREATE INDEX audit_time ON admin_audit_logs(occurred_at DESC);
CREATE INDEX audit_actor ON admin_audit_logs(actor_id);
CREATE INDEX incidents_status ON security_incidents(status,detected_at DESC);
CREATE INDEX governance_type_date ON governance_evidence(type,performed_at DESC);
CREATE INDEX offer_history_actor ON offer_history(actor_id);
CREATE TABLE import_batches (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, store_id text REFERENCES stores(id) ON DELETE SET NULL,
 actor_id text REFERENCES users(id) ON DELETE SET NULL, source_name text, status text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, total_rows integer, successful_rows integer, rejected_rows integer
); -- operational extension for existing Excel imports, not a new paid feature
CREATE TABLE import_rows (
 batch_id text REFERENCES import_batches(id) ON DELETE CASCADE, row_number integer NOT NULL,
 status text NOT NULL, error_code text, resulting_offer_id text REFERENCES offers(id) ON DELETE SET NULL,
 resulting_request_id text REFERENCES product_requests(id) ON DELETE SET NULL,
 input_snapshot jsonb, PRIMARY KEY(batch_id,row_number)
);
CREATE SCHEMA findi_migration;
REVOKE ALL ON SCHEMA findi_migration FROM PUBLIC;
CREATE TABLE findi_migration.source_documents (
 collection_name text NOT NULL, document_id text NOT NULL, source_payload jsonb NOT NULL,
 source_hash text NOT NULL, exported_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending', PRIMARY KEY(collection_name,document_id)
); -- TEMPORARY reconciliation staging; restricted + erased with subject data
CREATE TABLE findi_migration.issues (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, collection_name text NOT NULL, document_id text NOT NULL,
 field_name text, issue_code text NOT NULL, resolution text, resolved_at timestamptz
); -- do not log personal values in issue messages
REVOKE ALL ON ALL TABLES IN SCHEMA findi FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA findi FROM PUBLIC;
COMMIT;
