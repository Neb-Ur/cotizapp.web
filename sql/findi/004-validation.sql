-- Synthetic integrity/permission checks. EMPTY DISPOSABLE DB ONLY. Always rolled back.
BEGIN;
SET search_path=findi,pg_catalog;
INSERT INTO users(id,role,name,email) VALUES('qa-admin','admin','QA','admin@invalid.test'),('qa-owner','ferreteria','QA','owner@invalid.test'),('qa-a','maestro','QA','a@invalid.test'),('qa-b','maestro','QA','b@invalid.test');
INSERT INTO categories(id,name,icon) VALUES('qa-c','Maderas','objects-column');
INSERT INTO subcategories(id,category_id,name) VALUES('qa-s','qa-c','Tableros');
INSERT INTO families(id,subcategory_id,name) VALUES('qa-f','qa-s','MDF'),('qa-other','qa-s','Otro');
INSERT INTO brands(id,name,normalized_name) VALUES('qa-brand','QA','qa');
INSERT INTO products(id,family_id,brand_id,name) VALUES('qa-p','qa-f','qa-brand','MDF negro 18 mm'),('qa-p2','qa-other',NULL,'Otro');
INSERT INTO attribute_definitions(id,family_id,code,label,data_type) VALUES('qa-number','qa-f','espesor','Espesor','numero'),('qa-select','qa-f','color','Color','seleccion');
INSERT INTO attribute_options(definition_id,value) VALUES('qa-select','negro');
INSERT INTO product_attributes(product_id,family_id,definition_id,numeric_value) VALUES('qa-p','qa-f','qa-number',18);
INSERT INTO product_attributes(product_id,family_id,definition_id,option_value) VALUES('qa-p','qa-f','qa-select','negro');
INSERT INTO stores(id,owner_id,business_name,latitude,longitude,agreement_status,agreement_version,agreement_document_hash) VALUES('qa-store','qa-owner','Local QA',-33,-70,'vigente','qa','qa-hash');
INSERT INTO legal_documents(kind,version,document_hash,content,is_current) VALUES('store_agreement','qa','qa-hash','{}',true);
INSERT INTO offers(id,store_id,product_id,price,stock) VALUES('qa-o','qa-store','qa-p',1000,5);
INSERT INTO quotations(id,owner_id,name) VALUES('qa-q1','qa-a','Obra 1'),('qa-q2','qa-a','Obra 2');
INSERT INTO quotation_items(id,quotation_id,position,product_id,product_name_snapshot,quantity,selected_store_id,selected_offer_id,offer_reference)
 VALUES('qa-line','qa-q1',0,'qa-p','MDF negro 18 mm',2,'qa-store','qa-o','qa-o');
INSERT INTO seo_routes(path,product_id) VALUES('/productos/qa-mdf','qa-p');
INSERT INTO seo_routes(path,product_id,canonical_path,is_canonical) VALUES('/productos/qa-antiguo','qa-p','/productos/qa-mdf',false);
INSERT INTO offer_history(offer_id,store_id,product_id,offer_reference,store_reference,product_reference,action,source,includes_vat,occurred_at,new_price)
 VALUES('qa-o','qa-store','qa-p','qa-o','qa-store','qa-p','created','qa',true,now(),1000);
DO $$ BEGIN
 IF (SELECT count(*) FROM public_products WHERE id='qa-p')<>1 THEN RAISE EXCEPTION 'base product missing'; END IF;
 IF (SELECT count(*) FROM public_offers WHERE offer_id='qa-o')<>1 THEN RAISE EXCEPTION 'eligible offer missing'; END IF;
 BEGIN INSERT INTO offers(store_id,product_id,price,stock) VALUES('qa-store','qa-p',20,1); RAISE EXCEPTION 'duplicate offer accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN UPDATE offers SET stock=-1 WHERE id='qa-o'; RAISE EXCEPTION 'negative stock accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO quotations(owner_id,name) VALUES('qa-a','Third'); RAISE EXCEPTION 'third quotation accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE product_attributes SET text_value='18' WHERE definition_id='qa-number'; RAISE EXCEPTION 'multiple attribute values accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE product_attributes SET option_value='rojo' WHERE definition_id='qa-select'; RAISE EXCEPTION 'unknown option accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN UPDATE product_attributes SET numeric_value=NULL,text_value='18' WHERE definition_id='qa-number'; RAISE EXCEPTION 'wrong value type accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE attribute_definitions SET data_type='texto' WHERE id='qa-number'; RAISE EXCEPTION 'definition mutation corrupted values'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO product_attributes(product_id,family_id,definition_id,numeric_value) VALUES('qa-p2','qa-f','qa-number',3); RAISE EXCEPTION 'cross-family attribute accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN UPDATE quotation_items SET product_id='qa-p2' WHERE id='qa-line'; RAISE EXCEPTION 'offer-product mismatch accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE offers SET stock=0 WHERE id='qa-o';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public_offers WHERE offer_id='qa-o' AND NOT comparison_eligible) THEN RAISE EXCEPTION 'out-of-stock offer disappeared'; END IF;
END $$;
UPDATE offers SET price=0 WHERE id='qa-o';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public_offers WHERE offer_id='qa-o') THEN RAISE EXCEPTION 'zero price exposed'; END IF; END $$;
UPDATE offers SET price=1000,stock=5 WHERE id='qa-o';
UPDATE stores SET agreement_status='suspendido' WHERE id='qa-store';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public_offers WHERE offer_id='qa-o') THEN RAISE EXCEPTION 'suspended store public'; END IF; END $$;
UPDATE stores SET agreement_status='vigente' WHERE id='qa-store';
SELECT set_config('findi.user_id','qa-b',true);
SET LOCAL ROLE findi_api;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM quotations WHERE id='qa-q1') THEN RAISE EXCEPTION 'other owner quotation leaked'; END IF;
 IF EXISTS(SELECT 1 FROM offers WHERE id='qa-o') THEN RAISE EXCEPTION 'other store private offer leaked'; END IF;
END $$;
INSERT INTO quotations(id,owner_id,name) VALUES('qa-bq','qa-b','Owned quote');
INSERT INTO quotation_items(id,quotation_id,position,product_id,product_name_snapshot,quantity,selected_store_id,selected_offer_id)
 VALUES('qa-bline','qa-bq',0,'qa-p','MDF negro 18 mm',1,'qa-store','qa-o');
DO $$ BEGIN
 BEGIN UPDATE quotation_items SET product_id='qa-p2' WHERE id='qa-bline'; RAISE EXCEPTION 'RLS hid identity validation'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('findi.user_id','qa-a',true);
SET LOCAL ROLE findi_api;
DO $$ BEGIN IF (SELECT count(*) FROM quotations WHERE owner_id='qa-a')<>2 THEN RAISE EXCEPTION 'own quotations hidden'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE findi_public_reader;
DO $$ BEGIN
 IF (SELECT count(*) FROM public_products WHERE id='qa-p')<>1 THEN RAISE EXCEPTION 'public view unavailable'; END IF;
 BEGIN PERFORM 1 FROM users; RAISE EXCEPTION 'public reader can access private profiles'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM offers WHERE id='qa-o';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM quotation_items WHERE id='qa-line' AND selected_offer_id IS NULL AND product_name_snapshot='MDF negro 18 mm') THEN RAISE EXCEPTION 'quote did not survive offer removal'; END IF;
 IF NOT EXISTS(SELECT 1 FROM offer_history WHERE offer_id IS NULL AND offer_reference='qa-o') THEN RAISE EXCEPTION 'price evidence lost'; END IF;
END $$;
INSERT INTO job_runs(job_name,local_date,status,started_at) VALUES('store-daily-analytics',date '2026-10-08','running',now());
DO $$ BEGIN
 BEGIN INSERT INTO job_runs(job_name,local_date,status,started_at) VALUES('store-daily-analytics',date '2026-10-08','running',now()); RAISE EXCEPTION 'duplicate daily job accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;
