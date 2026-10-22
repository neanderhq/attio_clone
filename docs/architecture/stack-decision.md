# Stack decision

Starter: `nextjs` version `1`.

One production container on Cloud Run. PostgreSQL and Drizzle persist the CRM. Local email/password authentication uses salted scrypt password hashes and database-backed hashed session tokens. Memberships scope the typed Next.js API routes by workspace. Existing unassigned demo rows are retained but hidden; see `README.md` for current launch instructions and limitations.

Maintained source examples and exact dependency commands are in `.neander/blocks/`. Add one block only when its capability is requested; strip `.example` while merging into ordinary application files, generate the project lockfile and verify its documented checks. These examples are excluded from the production image until installed.
