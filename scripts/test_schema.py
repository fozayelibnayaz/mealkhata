"""SQLite constraint checks; D1 runtime smoke tests are a separate check."""
import sqlite3, unittest
from pathlib import Path

class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.executescript(Path('migrations/0001_foundation.sql').read_text())
        for mess in ['one','two']:
            self.db.execute("INSERT INTO messes VALUES(?,?, 'Asia/Dhaka','BDT','now')",(mess,mess))
            self.db.execute("INSERT INTO memberships VALUES(?,?,NULL,?,'manager','active',1)",(mess,'manager',mess))
            self.db.execute("INSERT INTO periods VALUES(?, 'sep','2026-09','open',1)",(mess,))
        self.db.execute("INSERT INTO memberships VALUES('two','outsider',NULL,'Outside','member','active',1)")
        self.db.commit()
    def tearDown(self): self.db.close()
    def meal(self,member='manager',slot='lunch',ident='entry'):
        self.db.execute("INSERT INTO meal_entries VALUES('one',?,'sep',?,'2026-09-19',?,100,'confirmed',1)",(ident,member,slot))
    def test_cross_mess_member_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError): self.meal('outsider')
    def test_duplicate_slot_rejected(self):
        self.meal()
        with self.assertRaises(sqlite3.IntegrityError): self.meal(ident='second')
    def test_closed_month_insert_rejected(self):
        self.db.execute("UPDATE periods SET status='closed' WHERE mess_id='one'")
        with self.assertRaisesRegex(sqlite3.IntegrityError,'closed'): self.meal()
    def test_closed_month_update_and_delete_rejected(self):
        self.meal();self.db.execute("UPDATE periods SET status='closed' WHERE mess_id='one'")
        for statement in ["UPDATE meal_entries SET meal_units=0", "DELETE FROM meal_entries"]:
            with self.assertRaisesRegex(sqlite3.IntegrityError,'closed'): self.db.execute(statement)
    def test_audit_cannot_be_edited_or_deleted(self):
        self.db.execute("INSERT INTO audit_events VALUES('one','event','manager','meal','entry','Initial',NULL,'{}','now')")
        for statement in ["UPDATE audit_events SET reason='hidden'", "DELETE FROM audit_events"]:
            with self.assertRaisesRegex(sqlite3.IntegrityError,'Audit'): self.db.execute(statement)
    def test_one_active_manager(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO memberships VALUES('one','extra',NULL,'Extra','manager','active',1)")
    def test_operation_unique_for_actor(self):
        sql="INSERT INTO operation_keys VALUES('one','manager','op','hash','{}','now')"
        self.db.execute(sql)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(sql)
    def test_failed_transaction_rolls_back_meal(self):
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.meal()
                self.db.execute("INSERT INTO audit_events VALUES('one','event','outsider','meal','entry','Initial',NULL,'{}','now')")
        self.assertEqual(self.db.execute('SELECT count(*) FROM meal_entries').fetchone()[0],0)

class AggregateTests(unittest.TestCase):
    def setUp(self):
        import json
        self.db=sqlite3.connect(':memory:')
        self.db.executescript(Path('migrations/0001_foundation.sql').read_text())
        self.db.executescript(Path('migrations/0002_workspaces.sql').read_text())
        self.db.execute("INSERT INTO users VALUES('u','google:test','Manager','now')")
        self.db.execute("INSERT INTO users VALUES('v','google:other','Other','now')")
        self.data=json.dumps({'members':[{'id':'m','userId':'u','active':True}]})
        self.db.execute("INSERT INTO workspace_documents VALUES('w',1,?,'u','op1','hash','{}','now')",(self.data,))
        self.db.commit()
    def tearDown(self): self.db.close()
    def test_schema_version(self): self.assertEqual(self.db.execute('SELECT version FROM schema_meta').fetchone()[0],2)
    def test_compare_and_swap_and_audit(self):
        a=self.db.execute("UPDATE workspace_documents SET revision=2,operation_id='op2' WHERE id='w' AND revision=1").rowcount
        b=self.db.execute("UPDATE workspace_documents SET revision=2,operation_id='op3' WHERE id='w' AND revision=1").rowcount
        self.assertEqual((a,b),(1,0))
        self.assertEqual(self.db.execute('SELECT count(*) FROM workspace_audit').fetchone()[0],2)
    def test_idempotency_collision_rolls_back_document_change(self):
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE workspace_documents SET revision=2 WHERE id='w'")
        self.assertEqual(self.db.execute("SELECT revision FROM workspace_documents").fetchone()[0],1)
    def test_access_index_tracks_actual_membership(self):
        import json
        data=json.dumps({'members':[{'id':'m','userId':'u','active':False},{'id':'n','userId':'v','active':True}]})
        self.db.execute("UPDATE workspace_documents SET data=?,revision=2,operation_id='op2' WHERE id='w'",(data,))
        self.assertEqual(self.db.execute('SELECT user_id FROM workspace_access').fetchall(),[('v',)])
    def test_audit_is_immutable(self):
        for sql in ['UPDATE workspace_audit SET revision=5','DELETE FROM workspace_audit']:
            with self.assertRaisesRegex(sqlite3.IntegrityError,'Audit'): self.db.execute(sql)

if __name__=='__main__': unittest.main(verbosity=2)
