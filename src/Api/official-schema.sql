CREATE TABLE official_release(
 key text PRIMARY KEY,
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN('draft','published')),
 metadata jsonb NOT NULL
);
CREATE TABLE official_source(
 release_id text NOT NULL REFERENCES official_release(key),
 id text NOT NULL,
 payload jsonb NOT NULL,
 PRIMARY KEY(release_id,id),
 CHECK(payload->>'id'=id),
 CHECK(payload->>'sha256' ~ '^[a-f0-9]{64}$')
);
CREATE TABLE official_history(
 release_id text NOT NULL REFERENCES official_release(key),
 id text NOT NULL,
 source_id text NOT NULL,
 payload jsonb NOT NULL,
 PRIMARY KEY(release_id,id),
 FOREIGN KEY(release_id,source_id) REFERENCES official_source(release_id,id),
 CHECK(payload->>'id'=id AND payload->>'sourceId'=source_id),
 CHECK(payload->>'state' IN('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')),
 CHECK(payload->>'visaSubclass' IN('190','491','combined')),
 CHECK(payload->>'occupationLevel' IN('occupation','unit_group','sub_major_group','all')),
 CHECK(payload->'points'='null'::jsonb OR (jsonb_typeof(payload->'points')='number' AND (payload->>'points')::numeric>=0)),
 CHECK(payload->'invitationCount'='null'::jsonb OR (jsonb_typeof(payload->'invitationCount')='number' AND (payload->>'invitationCount')::numeric>=0 AND (payload->>'invitationCount')::numeric=trunc((payload->>'invitationCount')::numeric)))
);
CREATE INDEX official_history_scope ON official_history(release_id,(payload->>'state'),(payload->>'programYear'),(payload->>'occupationCode'));
CREATE FUNCTION guard_official_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT FROM official_release WHERE key=COALESCE(NEW.release_id,OLD.release_id) AND status='published')
 OR (TG_OP<>'INSERT' AND EXISTS(SELECT FROM official_release WHERE key=OLD.release_id AND status='published'))
 THEN RAISE EXCEPTION 'Official history release is immutable'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER official_history_immutable BEFORE INSERT OR UPDATE OR DELETE ON official_history FOR EACH ROW EXECUTE FUNCTION guard_official_member();
CREATE TRIGGER official_source_immutable BEFORE INSERT OR UPDATE OR DELETE ON official_source FOR EACH ROW EXECUTE FUNCTION guard_official_member();
CREATE FUNCTION guard_official_release() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status='published' THEN RAISE EXCEPTION 'Official release is immutable';END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER official_release_immutable BEFORE UPDATE OR DELETE ON official_release FOR EACH ROW EXECUTE FUNCTION guard_official_release();
