CREATE TABLE jurisdiction(code text PRIMARY KEY, name_en text NOT NULL,name_zh text NOT NULL);
CREATE TABLE occupation(id text PRIMARY KEY,system text NOT NULL,version text NOT NULL,code text NOT NULL,title text NOT NULL,title_zh text NOT NULL,UNIQUE(system,version,code));
CREATE TABLE source_version(id text PRIMARY KEY,source_id text NOT NULL,title text NOT NULL,publisher text NOT NULL,url text,terms_url text,license text NOT NULL,hash text NOT NULL CHECK(hash~'^[a-f0-9]{64}$'),retrieved_at timestamptz NOT NULL,published_at timestamptz,effective_date date,decision_date date,storage_key text NOT NULL,review_note text NOT NULL,is_demo boolean NOT NULL,UNIQUE(source_id,hash));
CREATE TABLE dataset_version(key text PRIMARY KEY,mode text NOT NULL CHECK(mode IN('demo','verified_historical')),status text NOT NULL CHECK(status IN('draft','published','retracted')),published_at timestamptz NOT NULL DEFAULT now(),supersedes_key text REFERENCES dataset_version(key),note text NOT NULL);
CREATE TABLE dataset_source(version text REFERENCES dataset_version(key),source_version_id text REFERENCES source_version(id),PRIMARY KEY(version,source_version_id));
CREATE TABLE program_scope(id text PRIMARY KEY,state text NOT NULL REFERENCES jurisdiction(code),visa_subclass text NOT NULL CHECK(visa_subclass IN('190','491')),sponsorship_type text NOT NULL CHECK(sponsorship_type='state'),program_year text NOT NULL CHECK(program_year ~ '^[0-9]{4}-[0-9]{2}$' AND (left(program_year,4)::int+1)%100=right(program_year,2)::int),stream text NOT NULL,residence_category text NOT NULL,points_basis text NOT NULL,classification_version text NOT NULL,round_id text,event_date date);
CREATE TABLE observation_revision(id text PRIMARY KEY,canonical_key text NOT NULL,revision int NOT NULL CHECK(revision>0),scope_id text NOT NULL REFERENCES program_scope(id),occupation_id text REFERENCES occupation(id),metric_type text NOT NULL CHECK(metric_type IN('nomination_allocation','nomination_invitation_count','visa_invitation_count','eoi_stock_count','last_invited_eoi_points')),value numeric(18,2),unit text NOT NULL,status text NOT NULL CHECK(status IN('available','not_published','not_ingested','suppressed','not_applicable','parse_failed','source_unavailable')),null_reason text,event_date date,period_start date,period_end date,as_of_date date,eoi_effective_at timestamptz,source_version_id text NOT NULL REFERENCES source_version(id),locator text NOT NULL,is_demo boolean NOT NULL,CHECK((status='available' AND value IS NOT NULL AND null_reason IS NULL) OR(status<>'available' AND value IS NULL AND null_reason IS NOT NULL)),CHECK(value IS NULL OR value>=0),CHECK(value IS NULL OR metric_type='last_invited_eoi_points' OR value=trunc(value)),CHECK(metric_type<>'last_invited_eoi_points' OR value IS NULL OR value<=200),CHECK(period_end IS NULL OR period_start IS NULL OR period_end>=period_start),UNIQUE(canonical_key,revision),UNIQUE NULLS NOT DISTINCT(scope_id,occupation_id,metric_type,event_date,period_start,period_end,as_of_date,source_version_id,locator));
CREATE TABLE dataset_observation(version text REFERENCES dataset_version(key),observation_id text REFERENCES observation_revision(id),PRIMARY KEY(version,observation_id));
CREATE TABLE distribution(id text PRIMARY KEY,version text NOT NULL REFERENCES dataset_version(key),scope_id text NOT NULL REFERENCES program_scope(id),occupation_id text NOT NULL REFERENCES occupation(id),source_version_id text NOT NULL REFERENCES source_version(id),metric_type text NOT NULL,cohort_kind text NOT NULL CHECK(cohort_kind IN('published_sample','full_cohort','eoi_stock','last_invited')),denominator bigint CHECK(denominator>=0),definition text NOT NULL,locator text NOT NULL,UNIQUE(version,scope_id,occupation_id,metric_type,cohort_kind));
CREATE TABLE distribution_bin(id text PRIMARY KEY,distribution_id text NOT NULL REFERENCES distribution(id),lower numeric NOT NULL,upper numeric NOT NULL,lower_inclusive boolean NOT NULL DEFAULT true,upper_inclusive boolean NOT NULL DEFAULT true,count bigint,status text NOT NULL CHECK(status IN('available','not_published','suppressed')),CHECK(upper>=lower),CHECK(count IS NULL OR count>=0),CHECK((status='available' AND count IS NOT NULL) OR(status<>'available' AND count IS NULL)),UNIQUE(distribution_id,lower,upper));
CREATE TABLE publication_audit(id text PRIMARY KEY,version text NOT NULL REFERENCES dataset_version(key),at timestamptz NOT NULL DEFAULT now(),actor text NOT NULL,reason text NOT NULL);
CREATE INDEX facts_scope_metric ON observation_revision(scope_id,metric_type,event_date);
CREATE FUNCTION guard_membership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r dataset_version; o observation_revision;
BEGIN
 SELECT * INTO r FROM dataset_version WHERE key=COALESCE(NEW.version,OLD.version);
 IF r.status IN('published','retracted') OR (TG_OP<>'INSERT' AND EXISTS(SELECT FROM dataset_version WHERE key=OLD.version AND status IN('published','retracted'))) THEN RAISE EXCEPTION 'Published membership immutable';END IF;
 IF TG_OP<>'DELETE' THEN
  SELECT * INTO o FROM observation_revision WHERE id=NEW.observation_id;
  IF o.is_demo<>(r.mode='demo') THEN RAISE EXCEPTION 'Dataset mode mismatch';END IF;
  IF NOT EXISTS(SELECT FROM dataset_source WHERE version=r.key AND source_version_id=o.source_version_id) THEN RAISE EXCEPTION 'Evidence missing from release';END IF;
  IF EXISTS(SELECT FROM dataset_observation m JOIN observation_revision f ON f.id=m.observation_id WHERE m.version=r.key AND f.canonical_key=o.canonical_key AND m.observation_id<>NEW.observation_id) THEN RAISE EXCEPTION 'One revision per logical fact';END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER immutable_membership BEFORE INSERT OR UPDATE OR DELETE ON dataset_observation FOR EACH ROW EXECUTE FUNCTION guard_membership();
CREATE FUNCTION guard_fact() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP<>'DELETE' AND EXISTS(SELECT FROM source_version WHERE id=NEW.source_version_id AND is_demo<>NEW.is_demo) THEN RAISE EXCEPTION 'Fact-source mode mismatch';END IF;
 IF EXISTS(SELECT FROM dataset_observation m JOIN dataset_version d ON d.key=m.version WHERE m.observation_id=OLD.id AND d.status IN('published','retracted')) THEN RAISE EXCEPTION 'Published fact immutable';END IF;RETURN COALESCE(NEW,OLD);END $$;
CREATE TRIGGER immutable_fact BEFORE INSERT OR UPDATE OR DELETE ON observation_revision FOR EACH ROW EXECUTE FUNCTION guard_fact();
CREATE FUNCTION guard_release() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status IN('published','retracted') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Published release immutable';END IF;
  IF(to_jsonb(NEW)-'status')<>(to_jsonb(OLD)-'status') OR NOT(NEW.status=OLD.status OR OLD.status='published' AND NEW.status='retracted') THEN RAISE EXCEPTION 'Published release immutable';END IF;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.status='published' AND EXISTS(SELECT FROM dataset_observation m JOIN observation_revision f ON f.id=m.observation_id WHERE m.version=NEW.key AND (f.is_demo<>(NEW.mode='demo') OR NOT EXISTS(SELECT FROM dataset_source e WHERE e.version=NEW.key AND e.source_version_id=f.source_version_id))) THEN RAISE EXCEPTION 'Publication has inconsistent evidence';END IF;
 RETURN COALESCE(NEW,OLD);END $$;
CREATE TRIGGER immutable_release BEFORE UPDATE OR DELETE ON dataset_version FOR EACH ROW EXECUTE FUNCTION guard_release();
CREATE FUNCTION guard_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT FROM dataset_version WHERE (key=COALESCE(NEW.version,OLD.version) OR TG_OP<>'INSERT' AND key=OLD.version) AND status IN('published','retracted')) THEN RAISE EXCEPTION 'Published evidence immutable';END IF;
 IF TG_OP<>'DELETE' AND EXISTS(SELECT FROM source_version s JOIN dataset_version d ON d.key=NEW.version WHERE s.id=NEW.source_version_id AND s.is_demo<>(d.mode='demo')) THEN RAISE EXCEPTION 'Evidence mode mismatch';END IF;
 RETURN COALESCE(NEW,OLD);END $$;
CREATE TRIGGER immutable_evidence BEFORE INSERT OR UPDATE OR DELETE ON dataset_source FOR EACH ROW EXECUTE FUNCTION guard_evidence();
CREATE FUNCTION guard_distribution() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT FROM dataset_version WHERE (key=COALESCE(NEW.version,OLD.version) OR TG_OP<>'INSERT' AND key=OLD.version) AND status IN('published','retracted')) THEN RAISE EXCEPTION 'Published distribution immutable';END IF;
 IF TG_OP<>'DELETE' AND NOT EXISTS(SELECT FROM dataset_source WHERE version=NEW.version AND source_version_id=NEW.source_version_id) THEN RAISE EXCEPTION 'Distribution source not in release';END IF;RETURN COALESCE(NEW,OLD);END $$;
CREATE TRIGGER immutable_distribution BEFORE INSERT OR UPDATE OR DELETE ON distribution FOR EACH ROW EXECUTE FUNCTION guard_distribution();
CREATE FUNCTION guard_bin() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT FROM distribution x JOIN dataset_version d ON d.key=x.version WHERE (x.id=COALESCE(NEW.distribution_id,OLD.distribution_id) OR TG_OP<>'INSERT' AND x.id=OLD.distribution_id) AND d.status IN('published','retracted')) THEN RAISE EXCEPTION 'Published bins immutable';END IF;RETURN COALESCE(NEW,OLD);END $$;
CREATE TRIGGER immutable_bin BEFORE INSERT OR UPDATE OR DELETE ON distribution_bin FOR EACH ROW EXECUTE FUNCTION guard_bin();
CREATE FUNCTION guard_reference() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE used boolean;BEGIN
 IF TG_TABLE_NAME='source_version' THEN SELECT EXISTS(SELECT FROM dataset_source m JOIN dataset_version d ON d.key=m.version WHERE m.source_version_id=OLD.id AND d.status IN('published','retracted')) INTO used;
 ELSIF TG_TABLE_NAME='program_scope' THEN SELECT EXISTS(SELECT FROM observation_revision f JOIN dataset_observation m ON m.observation_id=f.id JOIN dataset_version d ON d.key=m.version WHERE f.scope_id=OLD.id AND d.status IN('published','retracted')) INTO used;
 ELSIF TG_TABLE_NAME='occupation' THEN SELECT EXISTS(SELECT FROM observation_revision f JOIN dataset_observation m ON m.observation_id=f.id JOIN dataset_version d ON d.key=m.version WHERE f.occupation_id=OLD.id AND d.status IN('published','retracted')) INTO used;END IF;
 IF used THEN RAISE EXCEPTION 'Published reference immutable';END IF;RETURN COALESCE(NEW,OLD);END $$;
CREATE TRIGGER immutable_source BEFORE UPDATE OR DELETE ON source_version FOR EACH ROW EXECUTE FUNCTION guard_reference();
CREATE TRIGGER immutable_scope BEFORE UPDATE OR DELETE ON program_scope FOR EACH ROW EXECUTE FUNCTION guard_reference();
CREATE TRIGGER immutable_occupation BEFORE UPDATE OR DELETE ON occupation FOR EACH ROW EXECUTE FUNCTION guard_reference();

CREATE FUNCTION guard_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit events are append-only'; END $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON publication_audit FOR EACH ROW EXECUTE FUNCTION guard_audit();
