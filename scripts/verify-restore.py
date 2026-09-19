"""Compare an operator SQL export against a restored LOCAL D1 SQLite file.
Usage: python3 scripts/verify-restore.py export.sql restored.sqlite
No source database is modified. No session secrets printed.
"""
import sqlite3,sys,hashlib,json
from pathlib import Path
expected=sqlite3.connect(':memory:')
expected.executescript(Path(sys.argv[1]).read_text())
restored=sqlite3.connect('file:'+str(Path(sys.argv[2]).resolve())+'?mode=ro',uri=True)
tables=['users','workspace_documents','workspace_operations','workspace_audit','workspace_access','invites','sessions','schema_meta']
for table in tables:
    a=sorted(expected.execute(f'SELECT * FROM {table}').fetchall(),key=str)
    b=sorted(restored.execute(f'SELECT * FROM {table}').fetchall(),key=str)
    assert a==b, f'Restore mismatch: {table}'
    print(f'PASS: {table} — {len(a)} rows match exactly')
assert restored.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
print('PASS: SQLite integrity check; read-only restore comparison complete.')
