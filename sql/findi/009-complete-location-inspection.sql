-- One read-only view per existing physical table, for privileged console inspection.
BEGIN;
CREATE SCHEMA IF NOT EXISTS findi_inspection;
REVOKE ALL ON SCHEMA findi_inspection FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.account_deletion_jobs WITH(security_barrier=true) AS
 SELECT "id" AS "id","user_id" AS "user_id","status" AS "status","auth_delete_confirmed_at" AS "auth_delete_confirmed_at","completed_at" AS "completed_at","attempts" AS "attempts","requested_at" AS "requested_at","last_error_code" AS "last_error_code","backup_erasure_expected_by" AS "backup_erasure_expected_by" FROM findi.account_deletion_jobs;
REVOKE ALL ON findi_inspection.account_deletion_jobs FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.account_locations WITH(security_barrier=true) AS
 SELECT "user_id" AS "user_id","region_code" AS "region_code","commune_code" AS "commune_code","city_id" AS "city_id","matched_at" AS "matched_at" FROM findi.account_locations;
REVOKE ALL ON findi_inspection.account_locations FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.account_preferences WITH(security_barrier=true) AS
 SELECT "user_id" AS "user_id","primary_store_id" AS "primary_store_id","selected_quotation_id" AS "selected_quotation_id","updated_at" AS "updated_at" FROM findi.account_preferences;
REVOKE ALL ON findi_inspection.account_preferences FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.admin_audit_logs WITH(security_barrier=true) AS
 SELECT "id" AS "id","actor_id" AS "actor_id","action" AS "action","actor_role" AS "actor_role","method" AS "method","path" AS "path","target_type" AS "target_type","target_reference" AS "target_reference","status_code" AS "status_code","outcome" AS "outcome","result_code" AS "result_code","details" AS "details","occurred_at" AS "occurred_at","retention_until" AS "retention_until","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.admin_audit_logs;
REVOKE ALL ON findi_inspection.admin_audit_logs FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.attribute_definitions WITH(security_barrier=true) AS
 SELECT "id" AS "id","family_id" AS "family_id","code" AS "code","label" AS "label","unit" AS "unit","data_type" AS "data_type","filterable" AS "filterable","required" AS "required","position" AS "position","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.attribute_definitions;
REVOKE ALL ON findi_inspection.attribute_definitions FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.attribute_options WITH(security_barrier=true) AS
 SELECT "definition_id" AS "definition_id","value" AS "value","label" AS "label","position" AS "position" FROM findi.attribute_options;
REVOKE ALL ON findi_inspection.attribute_options FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.brands WITH(security_barrier=true) AS
 SELECT "id" AS "id","name" AS "name","normalized_name" AS "normalized_name","created_at" AS "created_at","updated_at" AS "updated_at","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.brands;
REVOKE ALL ON findi_inspection.brands FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.catalog_revisions WITH(security_barrier=true) AS
 SELECT "scope" AS "scope","revision" AS "revision","changed_at" AS "changed_at" FROM findi.catalog_revisions;
REVOKE ALL ON findi_inspection.catalog_revisions FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.catalog_search_documents WITH(security_barrier=true) AS
 SELECT "product_id" AS "product_id","normalized_text" AS "normalized_text","search_vector"::text AS "search_vector","version" AS "version","updated_at" AS "updated_at" FROM findi.catalog_search_documents;
REVOKE ALL ON findi_inspection.catalog_search_documents FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.categories WITH(security_barrier=true) AS
 SELECT "id" AS "id","name" AS "name","icon" AS "icon","created_at" AS "created_at","updated_at" AS "updated_at","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.categories;
REVOKE ALL ON findi_inspection.categories FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.cities WITH(security_barrier=true) AS
 SELECT "id" AS "id","country_code" AS "country_code","name" AS "name","kind" AS "kind","source_reference" AS "source_reference" FROM findi.cities;
REVOKE ALL ON findi_inspection.cities FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.city_communes WITH(security_barrier=true) AS
 SELECT "city_id" AS "city_id","commune_code" AS "commune_code","source_reference" AS "source_reference" FROM findi.city_communes;
REVOKE ALL ON findi_inspection.city_communes FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.communes WITH(security_barrier=true) AS
 SELECT "code" AS "code","province_code" AS "province_code","name" AS "name","normalized_name" AS "normalized_name" FROM findi.communes;
REVOKE ALL ON findi_inspection.communes FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.consent_events WITH(security_barrier=true) AS
 SELECT "id" AS "id","user_id" AS "user_id","type" AS "type","version" AS "version","granted" AS "granted","source" AS "source","occurred_at" AS "occurred_at","document_hash" AS "document_hash","purpose" AS "purpose","express_consent" AS "express_consent","evidence" AS "evidence","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.consent_events;
REVOKE ALL ON findi_inspection.consent_events FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.contact_messages WITH(security_barrier=true) AS
 SELECT "id" AS "id","user_id" AS "user_id","type" AS "type","name" AS "name","email" AS "email","phone" AS "phone","commune" AS "commune","business_name" AS "business_name","message" AS "message","status" AS "status","privacy_consent" AS "privacy_consent","legal_acceptance" AS "legal_acceptance","created_at" AS "created_at","updated_at" AS "updated_at","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.contact_messages;
REVOKE ALL ON findi_inspection.contact_messages FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.content_rights WITH(security_barrier=true) AS
 SELECT "id" AS "id","source_type" AS "source_type","provider" AS "provider","source_url" AS "source_url","source_terms_url" AS "source_terms_url","authorization_reference" AS "authorization_reference","contains_third_party_marks" AS "contains_third_party_marks","trademark_authorization_reference" AS "trademark_authorization_reference","reviewed_by" AS "reviewed_by","reviewed_at" AS "reviewed_at","legal_hold" AS "legal_hold","retention_until" AS "retention_until" FROM findi.content_rights;
REVOKE ALL ON findi_inspection.content_rights FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.countries WITH(security_barrier=true) AS
 SELECT "code" AS "code","name" AS "name" FROM findi.countries;
REVOKE ALL ON findi_inspection.countries FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.database_migration_state WITH(security_barrier=true) AS
 SELECT "id" AS "id","status" AS "status","source_project" AS "source_project","verified_at" AS "verified_at","manifest" AS "manifest","updated_at" AS "updated_at" FROM findi.database_migration_state;
REVOKE ALL ON findi_inspection.database_migration_state FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.deletion_receipts WITH(security_barrier=true) AS
 SELECT "id" AS "id","completed_at" AS "completed_at","counts" AS "counts","source" AS "source","retention_until" AS "retention_until","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.deletion_receipts;
REVOKE ALL ON findi_inspection.deletion_receipts FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.families WITH(security_barrier=true) AS
 SELECT "id" AS "id","subcategory_id" AS "subcategory_id","name" AS "name","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.families;
REVOKE ALL ON findi_inspection.families FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.governance_evidence WITH(security_barrier=true) AS
 SELECT "id" AS "id","type" AS "type","outcome" AS "outcome","title" AS "title","owner_label" AS "owner_label","performed_at" AS "performed_at","next_review_at" AS "next_review_at","notes" AS "notes","evidence_url" AS "evidence_url","created_at" AS "created_at","created_by" AS "created_by","legal_hold" AS "legal_hold","retention_until" AS "retention_until","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.governance_evidence;
REVOKE ALL ON findi_inspection.governance_evidence FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.import_batches WITH(security_barrier=true) AS
 SELECT "id" AS "id","store_id" AS "store_id","actor_id" AS "actor_id","source_name" AS "source_name","status" AS "status","created_at" AS "created_at","completed_at" AS "completed_at","total_rows" AS "total_rows","successful_rows" AS "successful_rows","rejected_rows" AS "rejected_rows" FROM findi.import_batches;
REVOKE ALL ON findi_inspection.import_batches FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.import_rows WITH(security_barrier=true) AS
 SELECT "batch_id" AS "batch_id","row_number" AS "row_number","status" AS "status","error_code" AS "error_code","resulting_offer_id" AS "resulting_offer_id","resulting_request_id" AS "resulting_request_id","input_snapshot" AS "input_snapshot" FROM findi.import_rows;
REVOKE ALL ON findi_inspection.import_rows FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.ip_report_events WITH(security_barrier=true) AS
 SELECT "id" AS "id","report_id" AS "report_id","position" AS "position","status" AS "status","occurred_at" AS "occurred_at","actor_user_id" AS "actor_user_id","actor_kind" AS "actor_kind","resolution" AS "resolution" FROM findi.ip_report_events;
REVOKE ALL ON findi_inspection.ip_report_events FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.ip_reports WITH(security_barrier=true) AS
 SELECT "id" AS "id","user_id" AS "user_id","reference" AS "reference","receipt_token_hash" AS "receipt_token_hash","claimant_name" AS "claimant_name","claimant_email" AS "claimant_email","claimant_organization" AS "claimant_organization","claimant_capacity" AS "claimant_capacity","rights_type" AS "rights_type","content_type" AS "content_type","target_type" AS "target_type","target_reference" AS "target_reference","product_id" AS "product_id","offer_id" AS "offer_id","store_id" AS "store_id","content_url" AS "content_url","original_work_url" AS "original_work_url","work_description" AS "work_description","infringement_description" AS "infringement_description","declarations" AS "declarations","privacy_consent" AS "privacy_consent","status" AS "status","public_status_message" AS "public_status_message","assigned_to" AS "assigned_to","submitted_at" AS "submitted_at","acknowledged_at" AS "acknowledged_at","initial_review_due_at" AS "initial_review_due_at","target_resolution_at" AS "target_resolution_at","resolution" AS "resolution","resolved_at" AS "resolved_at","updated_at" AS "updated_at","minimized_at" AS "minimized_at","legal_hold" AS "legal_hold","retention_until" AS "retention_until","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.ip_reports;
REVOKE ALL ON findi_inspection.ip_reports FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.job_runs WITH(security_barrier=true) AS
 SELECT "job_name" AS "job_name","local_date"::text AS "local_date","time_zone" AS "time_zone","status" AS "status","started_at" AS "started_at","completed_at" AS "completed_at","failed_at" AS "failed_at","error_code" AS "error_code","stores_processed" AS "stores_processed","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.job_runs;
REVOKE ALL ON findi_inspection.job_runs FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.legal_documents WITH(security_barrier=true) AS
 SELECT "kind" AS "kind","version" AS "version","document_hash" AS "document_hash","content" AS "content","effective_at" AS "effective_at","is_current" AS "is_current" FROM findi.legal_documents;
REVOKE ALL ON findi_inspection.legal_documents FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.marketing_suppressions WITH(security_barrier=true) AS
 SELECT "email_hash" AS "email_hash","hash_scheme" AS "hash_scheme","suppressed_at" AS "suppressed_at","source" AS "source","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.marketing_suppressions;
REVOKE ALL ON findi_inspection.marketing_suppressions FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.media_assets WITH(security_barrier=true) AS
 SELECT "id" AS "id","url" AS "url","storage_path" AS "storage_path","mime_type" AS "mime_type","origin" AS "origin","rights_id" AS "rights_id","generated_by" AS "generated_by","generation_reference" AS "generation_reference","ai_disclosure" AS "ai_disclosure","alt_text" AS "alt_text","created_at" AS "created_at" FROM findi.media_assets;
REVOKE ALL ON findi_inspection.media_assets FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.offer_history WITH(security_barrier=true) AS
 SELECT "id" AS "id","offer_id" AS "offer_id","store_id" AS "store_id","product_id" AS "product_id","offer_reference" AS "offer_reference","store_reference" AS "store_reference","product_reference" AS "product_reference","actor_id" AS "actor_id","actor_account_deleted_at" AS "actor_account_deleted_at","action" AS "action","source" AS "source","old_price"::text AS "old_price","new_price"::text AS "new_price","includes_vat" AS "includes_vat","before_snapshot" AS "before_snapshot","after_snapshot" AS "after_snapshot","product_request_id" AS "product_request_id","price_report_id" AS "price_report_id","occurred_at" AS "occurred_at","legal_hold" AS "legal_hold","retention_until" AS "retention_until","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.offer_history;
REVOKE ALL ON findi_inspection.offer_history FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.offers WITH(security_barrier=true) AS
 SELECT "id" AS "id","store_id" AS "store_id","product_id" AS "product_id","store_sku" AS "store_sku","barcode" AS "barcode","price"::text AS "price","currency" AS "currency","stock" AS "stock","includes_vat" AS "includes_vat","measurement_unit" AS "measurement_unit","measurement_quantity"::text AS "measurement_quantity","measurement_source" AS "measurement_source","valid_from" AS "valid_from","valid_until" AS "valid_until","conditions" AS "conditions","active" AS "active","published" AS "published","sponsored" AS "sponsored","withdrawal_reason" AS "withdrawal_reason","ip_status" AS "ip_status","previous_ip_state" AS "previous_ip_state","ip_report_id" AS "ip_report_id","created_at" AS "created_at","updated_at" AS "updated_at","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.offers;
REVOKE ALL ON findi_inspection.offers FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.outbox_events WITH(security_barrier=true) AS
 SELECT "id" AS "id","topic" AS "topic","entity_type" AS "entity_type","entity_reference" AS "entity_reference","payload" AS "payload","created_at" AS "created_at","processed_at" AS "processed_at","attempts" AS "attempts","last_error_code" AS "last_error_code" FROM findi.outbox_events;
REVOKE ALL ON findi_inspection.outbox_events FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.price_reports WITH(security_barrier=true) AS
 SELECT "id" AS "id","reference" AS "reference","user_id" AS "user_id","email" AS "email","product_id" AS "product_id","store_id" AS "store_id","offer_id" AS "offer_id","product_name_snapshot" AS "product_name_snapshot","store_name_snapshot" AS "store_name_snapshot","store_reference" AS "store_reference","offer_reference" AS "offer_reference","content_url" AS "content_url","displayed_price"::text AS "displayed_price","catalog_price_at_report"::text AS "catalog_price_at_report","observed_price"::text AS "observed_price","details" AS "details","privacy_consent" AS "privacy_consent","status" AS "status","resolution" AS "resolution","resolved_at" AS "resolved_at","resolved_by" AS "resolved_by","created_at" AS "created_at","updated_at" AS "updated_at","minimized_at" AS "minimized_at","legal_hold" AS "legal_hold","retention_until" AS "retention_until","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.price_reports;
REVOKE ALL ON findi_inspection.price_reports FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.privacy_requests WITH(security_barrier=true) AS
 SELECT "id" AS "id","user_id" AS "user_id","email" AS "email","type" AS "type","details" AS "details","status" AS "status","submitted_at" AS "submitted_at","acknowledged_at" AS "acknowledged_at","response_due_at" AS "response_due_at","blocking_due_at" AS "blocking_due_at","resolution" AS "resolution","resolved_at" AS "resolved_at","resolved_by" AS "resolved_by","updated_at" AS "updated_at","legal_hold" AS "legal_hold","retention_until" AS "retention_until","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.privacy_requests;
REVOKE ALL ON findi_inspection.privacy_requests FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.product_attributes WITH(security_barrier=true) AS
 SELECT "id" AS "id","product_id" AS "product_id","family_id" AS "family_id","definition_id" AS "definition_id","code_snapshot" AS "code_snapshot","label_snapshot" AS "label_snapshot","text_value" AS "text_value","numeric_value"::text AS "numeric_value","boolean_value" AS "boolean_value","option_value" AS "option_value","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.product_attributes;
REVOKE ALL ON findi_inspection.product_attributes FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.product_content_rights WITH(security_barrier=true) AS
 SELECT "product_id" AS "product_id","rights_id" AS "rights_id" FROM findi.product_content_rights;
REVOKE ALL ON findi_inspection.product_content_rights FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.product_features WITH(security_barrier=true) AS
 SELECT "product_id" AS "product_id","position" AS "position","text" AS "text" FROM findi.product_features;
REVOKE ALL ON findi_inspection.product_features FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.product_media WITH(security_barrier=true) AS
 SELECT "product_id" AS "product_id","asset_id" AS "asset_id","position" AS "position","in_gallery" AS "in_gallery","is_primary" AS "is_primary" FROM findi.product_media;
REVOKE ALL ON findi_inspection.product_media FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.product_models WITH(security_barrier=true) AS
 SELECT "id" AS "id","family_id" AS "family_id","name" AS "name","description" AS "description" FROM findi.product_models;
REVOKE ALL ON findi_inspection.product_models FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.product_requests WITH(security_barrier=true) AS
 SELECT "id" AS "id","store_id" AS "store_id","requester_id" AS "requester_id","admin_id" AS "admin_id","product_name" AS "product_name","barcode" AS "barcode","store_sku" AS "store_sku","published" AS "published","reference_quantity" AS "reference_quantity","reference_price"::text AS "reference_price","status" AS "status","request_type" AS "request_type","suggested_product_id" AS "suggested_product_id","resulting_offer_id" AS "resulting_offer_id","admin_notes" AS "admin_notes","created_at" AS "created_at","resolved_at" AS "resolved_at","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.product_requests;
REVOKE ALL ON findi_inspection.product_requests FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.products WITH(security_barrier=true) AS
 SELECT "id" AS "id","family_id" AS "family_id","model_id" AS "model_id","brand_id" AS "brand_id","legacy_brand_label" AS "legacy_brand_label","name" AS "name","product_type" AS "product_type","catalog_level" AS "catalog_level","sale_unit" AS "sale_unit","presentation" AS "presentation","barcode" AS "barcode","short_description" AS "short_description","long_description" AS "long_description","logistics_weight_kg"::text AS "logistics_weight_kg","logistics_volume_m3"::text AS "logistics_volume_m3","units_per_pallet"::text AS "units_per_pallet","status" AS "status","source_kind" AS "source_kind","source_reference" AS "source_reference","source_batch" AS "source_batch","ip_status" AS "ip_status","deleted_at" AS "deleted_at","created_at" AS "created_at","updated_at" AS "updated_at","ip_report_id" AS "ip_report_id","api_payload" AS "api_payload","api_version" AS "api_version","model_label" AS "model_label","manufacturer_code" AS "manufacturer_code","catalog_evidence" AS "catalog_evidence" FROM findi.products;
REVOKE ALL ON findi_inspection.products FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.provinces WITH(security_barrier=true) AS
 SELECT "code" AS "code","region_code" AS "region_code","name" AS "name" FROM findi.provinces;
REVOKE ALL ON findi_inspection.provinces FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.public_cache_artifacts WITH(security_barrier=true) AS
 SELECT "key" AS "key","scope" AS "scope","version" AS "version","object_path" AS "object_path","payload" AS "payload","schema_version" AS "schema_version","updated_at" AS "updated_at","expires_at" AS "expires_at" FROM findi.public_cache_artifacts;
REVOKE ALL ON findi_inspection.public_cache_artifacts FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.quotation_items WITH(security_barrier=true) AS
 SELECT "id" AS "id","quotation_id" AS "quotation_id","position" AS "position","product_id" AS "product_id","product_name_snapshot" AS "product_name_snapshot","quantity" AS "quantity","selected_store_id" AS "selected_store_id","selected_store_name_snapshot" AS "selected_store_name_snapshot","selected_offer_id" AS "selected_offer_id","product_reference" AS "product_reference","store_reference" AS "store_reference","offer_reference" AS "offer_reference","resolution_state" AS "resolution_state" FROM findi.quotation_items;
REVOKE ALL ON findi_inspection.quotation_items FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.quotations WITH(security_barrier=true) AS
 SELECT "id" AS "id","owner_id" AS "owner_id","name" AS "name","address" AS "address","proximity_latitude"::text AS "proximity_latitude","proximity_longitude"::text AS "proximity_longitude","proximity_radius_km"::text AS "proximity_radius_km","single_store_id" AS "single_store_id","single_store_name_snapshot" AS "single_store_name_snapshot","single_store_reference" AS "single_store_reference","status" AS "status","created_at" AS "created_at","updated_at" AS "updated_at","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.quotations;
REVOKE ALL ON findi_inspection.quotations FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.regions WITH(security_barrier=true) AS
 SELECT "code" AS "code","country_code" AS "country_code","name" AS "name","abbreviation" AS "abbreviation","source_reference" AS "source_reference" FROM findi.regions;
REVOKE ALL ON findi_inspection.regions FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.security_incidents WITH(security_barrier=true) AS
 SELECT "id" AS "id","title" AS "title","description" AS "description","severity" AS "severity","status" AS "status","detected_at" AS "detected_at","systems" AS "systems","data_categories" AS "data_categories","affected_people_estimate" AS "affected_people_estimate","reasonable_risk" AS "reasonable_risk","agency_notification_required" AS "agency_notification_required","containment_actions" AS "containment_actions","root_cause" AS "root_cause","lessons_learned" AS "lessons_learned","agency_notified_at" AS "agency_notified_at","subjects_notified_at" AS "subjects_notified_at","closed_at" AS "closed_at","created_by" AS "created_by","updated_by" AS "updated_by","created_at" AS "created_at","updated_at" AS "updated_at","legal_hold" AS "legal_hold","retention_until" AS "retention_until","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.security_incidents;
REVOKE ALL ON findi_inspection.security_incidents FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.seo_routes WITH(security_barrier=true) AS
 SELECT "path" AS "path","product_id" AS "product_id","category_id" AS "category_id","family_id" AS "family_id","brand_id" AS "brand_id","canonical_path" AS "canonical_path","is_canonical" AS "is_canonical","active" AS "active","title_override" AS "title_override","description_override" AS "description_override","created_at" AS "created_at" FROM findi.seo_routes;
REVOKE ALL ON findi_inspection.seo_routes FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.source_replication_versions WITH(security_barrier=true) AS
 SELECT "collection_name" AS "collection_name","document_id" AS "document_id","source_version"::text AS "source_version","deleted" AS "deleted","replicated_at" AS "replicated_at" FROM findi.source_replication_versions;
REVOKE ALL ON findi_inspection.source_replication_versions FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.store_agreements WITH(security_barrier=true) AS
 SELECT "id" AS "id","store_id" AS "store_id","store_reference" AS "store_reference","signer_user_id" AS "signer_user_id","version" AS "version","document_hash" AS "document_hash","status" AS "status","provider_snapshot" AS "provider_snapshot","store_snapshot" AS "store_snapshot","signer_snapshot" AS "signer_snapshot","declarations" AS "declarations","evidence" AS "evidence","accepted_at" AS "accepted_at","updated_at" AS "updated_at","terminated_at" AS "terminated_at","termination_reason" AS "termination_reason","modified_by" AS "modified_by","legal_hold" AS "legal_hold","delete_after" AS "delete_after","document_kind" AS "document_kind","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.store_agreements;
REVOKE ALL ON findi_inspection.store_agreements FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.store_daily_analytics WITH(security_barrier=true) AS
 SELECT "store_id" AS "store_id","local_date"::text AS "local_date","schema_version" AS "schema_version","computed_at" AS "computed_at","active_window_days" AS "active_window_days","quotation_count" AS "quotation_count","quoted_lines" AS "quoted_lines","quoted_units" AS "quoted_units","quoted_products" AS "quoted_products","active_quotation_count" AS "active_quotation_count","active_quoted_units" AS "active_quoted_units","active_quoted_amount"::text AS "active_quoted_amount","recent_quotation_count" AS "recent_quotation_count","previous_quotation_count" AS "previous_quotation_count","views" AS "views","selections" AS "selections","catalog_total" AS "catalog_total","catalog_published" AS "catalog_published","catalog_in_stock" AS "catalog_in_stock","catalog_out_of_stock" AS "catalog_out_of_stock","catalog_stale_prices" AS "catalog_stale_prices","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.store_daily_analytics;
REVOKE ALL ON findi_inspection.store_daily_analytics FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.store_daily_top_products WITH(security_barrier=true) AS
 SELECT "store_id" AS "store_id","local_date"::text AS "local_date","rank" AS "rank","product_id" AS "product_id","product_reference" AS "product_reference","product_name_snapshot" AS "product_name_snapshot","quotation_count" AS "quotation_count","units" AS "units","active_amount"::text AS "active_amount","stock" AS "stock" FROM findi.store_daily_top_products;
REVOKE ALL ON findi_inspection.store_daily_top_products FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.store_event_counters WITH(security_barrier=true) AS
 SELECT "store_id" AS "store_id","views" AS "views","selections" AS "selections","updated_at" AS "updated_at","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.store_event_counters;
REVOKE ALL ON findi_inspection.store_event_counters FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.store_locations WITH(security_barrier=true) AS
 SELECT "store_id" AS "store_id","region_code" AS "region_code","commune_code" AS "commune_code","city_id" AS "city_id","matched_at" AS "matched_at" FROM findi.store_locations;
REVOKE ALL ON findi_inspection.store_locations FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.stores WITH(security_barrier=true) AS
 SELECT "id" AS "id","owner_id" AS "owner_id","business_name" AS "business_name","legal_name" AS "legal_name","tax_id" AS "tax_id","branch_name" AS "branch_name","address" AS "address","region" AS "region","city" AS "city","commune" AS "commune","public_email" AS "public_email","public_phone" AS "public_phone","latitude"::text AS "latitude","longitude"::text AS "longitude","status" AS "status","agreement_status" AS "agreement_status","agreement_version" AS "agreement_version","agreement_document_hash" AS "agreement_document_hash","agreement_accepted_at" AS "agreement_accepted_at","agreement_updated_at" AS "agreement_updated_at","catalog_updated_at" AS "catalog_updated_at","ip_status" AS "ip_status","previous_ip_state" AS "previous_ip_state","created_at" AS "created_at","updated_at" AS "updated_at","ip_report_id" AS "ip_report_id","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.stores;
REVOKE ALL ON findi_inspection.stores FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.subcategories WITH(security_barrier=true) AS
 SELECT "id" AS "id","category_id" AS "category_id","name" AS "name","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.subcategories;
REVOKE ALL ON findi_inspection.subcategories FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.users WITH(security_barrier=true) AS
 SELECT "id" AS "id","role" AS "role","name" AS "name","email" AS "email","phone" AS "phone","region" AS "region","city" AS "city","commune" AS "commune","address" AS "address","account_status" AS "account_status","processing_blocked" AS "processing_blocked","blocked_at" AS "blocked_at","unblocked_at" AS "unblocked_at","terms_version" AS "terms_version","terms_accepted_at" AS "terms_accepted_at","privacy_version" AS "privacy_version","privacy_informed_at" AS "privacy_informed_at","age_confirmed" AS "age_confirmed","marketing_consent" AS "marketing_consent","marketing_updated_at" AS "marketing_updated_at","quotation_limit" AS "quotation_limit","created_at" AS "created_at","updated_at" AS "updated_at","api_payload" AS "api_payload","api_version" AS "api_version" FROM findi.users;
REVOKE ALL ON findi_inspection.users FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.issues WITH(security_barrier=true) AS
 SELECT "id" AS "id","collection_name" AS "collection_name","document_id" AS "document_id","field_name" AS "field_name","issue_code" AS "issue_code","resolution" AS "resolution","resolved_at" AS "resolved_at" FROM findi_migration.issues;
REVOKE ALL ON findi_inspection.issues FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.source_documents WITH(security_barrier=true) AS
 SELECT "collection_name" AS "collection_name","document_id" AS "document_id","source_payload" AS "source_payload","source_hash" AS "source_hash","exported_at" AS "exported_at","expires_at" AS "expires_at","status" AS "status" FROM findi_migration.source_documents;
REVOKE ALL ON findi_inspection.source_documents FROM PUBLIC;
CREATE OR REPLACE VIEW findi_inspection.findi_schema_migrations WITH(security_barrier=true) AS
 SELECT "version" AS "version","sha256" AS "sha256","applied_at" AS "applied_at" FROM public.findi_schema_migrations;
REVOKE ALL ON findi_inspection.findi_schema_migrations FROM PUBLIC;
DO $$
DECLARE reader record;
BEGIN
 FOR reader IN SELECT rolname FROM pg_roles WHERE rolname IN ('firebasereader_cotizapp-d71c8-database_public','firebasewriter_cotizapp-d71c8-database_public') LOOP
  EXECUTE format('GRANT USAGE ON SCHEMA findi_inspection TO %I',reader.rolname);
  EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA findi_inspection TO %I',reader.rolname);
 END LOOP;
END $$;
COMMIT;
