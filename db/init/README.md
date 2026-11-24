Put a MySQL dump of the production database here (`*.sql` or `*.sql.gz`).
MySQL imports it automatically the **first** time the `db` container starts.

Make a dump on the server, e.g.:

    mysqldump -u <user> -p --single-transaction --routines <database> > automatches.sql

To re-import later, wipe the volume: `docker compose -f docker-compose.local.yml down -v`.

Dump files are gitignored.
