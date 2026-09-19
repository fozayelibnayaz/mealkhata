CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX session_expiry ON sessions(expires_at);
CREATE TABLE oauth_flows (state_hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, nonce TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE rate_buckets (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
-- Bounded per-mess aggregate with optimistic concurrency. See ADR-002.
CREATE TABLE workspace_documents (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision>0), data TEXT NOT NULL CHECK(json_valid(data)),
 actor_id TEXT NOT NULL REFERENCES users(id), operation_id TEXT NOT NULL, request_hash TEXT NOT NULL,
 change_json TEXT NOT NULL CHECK(json_valid(change_json)), updated_at TEXT NOT NULL
);
CREATE TABLE workspace_operations (workspace_id TEXT NOT NULL REFERENCES workspace_documents(id), actor_id TEXT NOT NULL, operation_id TEXT NOT NULL, request_hash TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(workspace_id,actor_id,operation_id));
CREATE TABLE workspace_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,workspace_id TEXT NOT NULL REFERENCES workspace_documents(id),revision INTEGER NOT NULL,actor_id TEXT NOT NULL,change_json TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX workspace_audit_scope ON workspace_audit(workspace_id,id);
CREATE TRIGGER workspace_update_log AFTER UPDATE ON workspace_documents BEGIN
 INSERT INTO workspace_operations VALUES(NEW.id,NEW.actor_id,NEW.operation_id,NEW.request_hash,NEW.revision);
 INSERT INTO workspace_audit(workspace_id,revision,actor_id,change_json,created_at) VALUES(NEW.id,NEW.revision,NEW.actor_id,NEW.change_json,NEW.updated_at);
END;
CREATE TRIGGER workspace_insert_log AFTER INSERT ON workspace_documents BEGIN
 INSERT INTO workspace_operations VALUES(NEW.id,NEW.actor_id,NEW.operation_id,NEW.request_hash,NEW.revision);
 INSERT INTO workspace_audit(workspace_id,revision,actor_id,change_json,created_at) VALUES(NEW.id,NEW.revision,NEW.actor_id,NEW.change_json,NEW.updated_at);
END;
CREATE TRIGGER workspace_audit_no_update BEFORE UPDATE ON workspace_audit BEGIN SELECT RAISE(ABORT,'Audit events cannot be updated'); END;
CREATE TRIGGER workspace_audit_no_delete BEFORE DELETE ON workspace_audit BEGIN SELECT RAISE(ABORT,'Audit events cannot be deleted'); END;
CREATE TABLE workspace_access (workspace_id TEXT NOT NULL REFERENCES workspace_documents(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(workspace_id,user_id));
CREATE TABLE invites (token_hash TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspace_documents(id),created_by TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)));
CREATE INDEX invite_workspace ON invites(workspace_id);
UPDATE schema_meta SET version=2 WHERE id=1;
CREATE TRIGGER workspace_access_insert AFTER INSERT ON workspace_documents BEGIN
 INSERT INTO workspace_access SELECT NEW.id,json_extract(value,'$.userId') FROM json_each(NEW.data,'$.members') WHERE json_extract(value,'$.userId') IS NOT NULL AND json_extract(value,'$.active')=1;
END;
CREATE TRIGGER workspace_access_update AFTER UPDATE ON workspace_documents BEGIN
 DELETE FROM workspace_access WHERE workspace_id=NEW.id;
 INSERT INTO workspace_access SELECT NEW.id,json_extract(value,'$.userId') FROM json_each(NEW.data,'$.members') WHERE json_extract(value,'$.userId') IS NOT NULL AND json_extract(value,'$.active')=1;
END;
