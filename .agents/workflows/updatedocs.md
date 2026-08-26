---
description: 
---

# Update HRMS Documentation

When `/updatedoc` is invoked:

1. Inspect both `hrms-be` and `hrms-fe` source code.
2. Read `README.md`, `ROADMAP.md`, and latest `progress/session-XX.md`.
3. Compare actual implementation against ROADMAP.
4. Update `ROADMAP.md`:
   - `[x]` implemented + verified
   - `[~]` implemented but incomplete/unverified
   - `[ ]` not implemented
   - Update Known Issues only with real unresolved issues.
5. Update `README.md` only if architecture, setup, features, or configuration changed.
6. Create the next sequential `progress/session-XX.md`.
   Keep it short: Done, Verified, Known Issues, Next.
7. Do not modify application code.
8. Do not invent features or mark code as verified without evidence.
9. Do not create additional documentation files.
10. Run relevant build/type checks before marking changes verified.