---
trigger: always_on
---

# HRMS Documentation & Testing Rules

`README.md` = project context/setup.
`ROADMAP.md` = master checklist + active issue tracker.
`progress/session-XX.md` = short session context.

Code is the source of truth.

Never invent status. Verify before marking `[x]`.
Keep documentation concise.
Never modify application code during `/updatedoc`.
Always preserve sequential session numbering.

### Database & Testing Isolation Rules
1. **Zero-Mutation on Existing Data**: While testing or verifying features, you MUST NEVER modify, overwrite, or mutate any existing database records belonging to real users or existing tenant organizations. If an edge case absolutely requires modifying existing data, you MUST prompt the user and obtain explicit permission beforehand.
2. **Dedicated Test Entities**: Always create isolated test entities (e.g. dedicated test users, test companies, test balances) for all test and verification executions.
3. **Mandatory Test Data Cleanup**: When you create any data in the database for testing or verification purposes, you MUST always clean up and permanently delete all that created test data from the database upon completion.
4. **Temporary Artifacts Cleanup**: Before reporting completion, inspect the files you created during the task and delete all temporary/scratch test scripts that are no longer required.

5. **Mandatory Test-Data Naming Convention**: Any data created outside the formal 
   test suite (`tests/`) — including ad-hoc verification scripts, manual API calls 
   made while debugging, or exploratory checks during a task — MUST use an 
   unambiguous, greppable marker in identifying fields:
   - Company name must be prefixed `ZZTEST_` (e.g. `ZZTEST_Verification Co`)
   - User emails must use the domain `@zztest.internal` (e.g. `user1@zztest.internal`)
   This applies whether the data is created via a scratch script, a manual curl/API 
   call, or directly via Prisma in an exploratory session — not just within 
   `tests/*.test.ts`.

6. **End-of-Task Self-Audit Report**: Before reporting any task complete, the agent 
   must query the database for any row matching the naming convention in rule 5 
   and report exact counts: "Created during this task: X. Deleted during this 
   task: X. Remaining: 0." If remaining > 0, the agent must delete them before 
   completing, or explicitly explain why they cannot be deleted and ask for guidance 
   — never report completion with known leftover data.

7. **Independent Sweep Script (safety net)**: A standalone script, runnable by the 
   product owner independent of any agent task, must exist to list every Company 
   and User in the database whose name/email matches the `ZZTEST_` / `@zztest.internal` 
   convention, or otherwise looks anomalous (e.g. companies with zero employees 
   older than 1 day, users with no linked EmployeeProfile and no SUPER_ADMIN role — 
   per the earlier orphaned-user finding). This script reports only — it does not 
   delete anything automatically without explicit confirmation, since a false-positive 
   match against real tenant data would be far worse than a leftover row.