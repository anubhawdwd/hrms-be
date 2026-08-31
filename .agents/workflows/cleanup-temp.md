---
description: cleans temp files created by agent during testing
---

## Temporary/Test File Cleanup — REQUIRED

During implementation, you may create temporary scripts/files for inspection, migration, testing, or verification.

Before finishing the task:

1. Delete every temporary file created specifically for this task.
2. This includes files such as:
   - `apply-*.js`
   - `update-*.js`
   - `setup-*.js`
   - `fix-*.js`
   - `clean-*.js`
   - `verify-*.ts`
   - `test-*.ts`
   - any other one-off scripts created during implementation
3. Do NOT delete existing project files or legitimate scripts.
4. Check both `hrms-be` and `hrms-fe` for temporary artifacts created during this task.
5. Confirm the working tree/project contains no leftover temporary implementation or verification files.

Temporary scripts must NOT become part of the project unless they are intentionally required as permanent tooling.

Final report must include:
**Temporary files cleaned: Yes/No**