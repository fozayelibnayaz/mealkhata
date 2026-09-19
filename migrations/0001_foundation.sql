-- Local schema foundation only. Auth and financial posting workflows are not enabled.
PRAGMA foreign_keys = ON;
CREATE TABLE schema_meta (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
INSERT INTO schema_meta VALUES (1,1);
CREATE TABLE users (id TEXT PRIMARY KEY, provider_subject TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE messes (id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka', currency TEXT NOT NULL DEFAULT 'BDT' CHECK(currency='BDT'), created_at TEXT NOT NULL);
CREATE TABLE memberships (
 mess_id TEXT NOT NULL REFERENCES messes(id), id TEXT NOT NULL, user_id TEXT REFERENCES users(id),
 display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('manager','member')),
 status TEXT NOT NULL CHECK(status IN ('active','left')), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(mess_id,id), UNIQUE(mess_id,user_id)
);
CREATE UNIQUE INDEX one_active_manager ON memberships(mess_id) WHERE role='manager' AND status='active';
CREATE TABLE periods (
 mess_id TEXT NOT NULL REFERENCES messes(id), id TEXT NOT NULL, month TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), PRIMARY KEY(mess_id,id), UNIQUE(mess_id,month)
);
CREATE TABLE meal_entries (
 mess_id TEXT NOT NULL, id TEXT NOT NULL, period_id TEXT NOT NULL, member_id TEXT NOT NULL,
 business_date TEXT NOT NULL, slot TEXT NOT NULL CHECK(slot IN ('breakfast','lunch','dinner')),
 meal_units INTEGER NOT NULL CHECK(meal_units BETWEEN 0 AND 100000),
 status TEXT NOT NULL CHECK(status IN ('planned','confirmed')), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(mess_id,id), UNIQUE(mess_id,member_id,business_date,slot),
 FOREIGN KEY(mess_id,period_id) REFERENCES periods(mess_id,id),
 FOREIGN KEY(mess_id,member_id) REFERENCES memberships(mess_id,id)
);
CREATE INDEX meals_by_period ON meal_entries(mess_id,period_id,member_id);
CREATE TABLE operation_keys (
 mess_id TEXT NOT NULL, member_id TEXT NOT NULL, operation_id TEXT NOT NULL,
 request_hash TEXT NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(mess_id,member_id,operation_id), FOREIGN KEY(mess_id,member_id) REFERENCES memberships(mess_id,id)
);
CREATE TABLE audit_events (
 mess_id TEXT NOT NULL, id TEXT NOT NULL, actor_id TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL, reason TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL,
 PRIMARY KEY(mess_id,id), FOREIGN KEY(mess_id,actor_id) REFERENCES memberships(mess_id,id)
);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'Audit events cannot be updated'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'Audit events cannot be deleted'); END;
CREATE TRIGGER meal_no_closed_insert BEFORE INSERT ON meal_entries
 WHEN EXISTS(SELECT 1 FROM periods WHERE mess_id=NEW.mess_id AND id=NEW.period_id AND status='closed')
 BEGIN SELECT RAISE(ABORT,'Period is closed'); END;
CREATE TRIGGER meal_no_closed_update BEFORE UPDATE ON meal_entries
 WHEN EXISTS(SELECT 1 FROM periods WHERE mess_id=OLD.mess_id AND id=OLD.period_id AND status='closed')
 OR EXISTS(SELECT 1 FROM periods WHERE mess_id=NEW.mess_id AND id=NEW.period_id AND status='closed')
 BEGIN SELECT RAISE(ABORT,'Period is closed'); END;
CREATE TRIGGER meal_no_closed_delete BEFORE DELETE ON meal_entries
 WHEN EXISTS(SELECT 1 FROM periods WHERE mess_id=OLD.mess_id AND id=OLD.period_id AND status='closed')
 BEGIN SELECT RAISE(ABORT,'Period is closed'); END;
