# Release And Merge Checklist

Use this checklist before merging `develop` into `main`, cutting a release, or promoting a substantial feature branch.

## Required Checks

- [ ] `git status` is clean
- [ ] No generated artifacts are staged or committed (`dist`, `coverage`, `apps/web/test-results`, traces, logs)
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`

## Change Review

- [ ] Environment example files were updated if required
- [ ] README or docs were updated for user-facing or setup changes
- [ ] Database migrations were reviewed if backend schema changed
- [ ] New dependencies were reviewed for necessity
- [ ] Large bundle or performance warnings were reviewed

## Merge Gate

- [ ] CI is green on the latest commit
- [ ] Render or deployment checks are green on the latest commit
- [ ] PR was reviewed or self-reviewed against risk areas
- [ ] Branch is up to date with `main`

## Recommended Commands

```powershell
npm run typecheck
npm run test
npm run build
npm run test:e2e
```
