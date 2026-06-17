## Plan: Remove Google OAuth, keep email + password only

The auth page already has a working email/password signup + sign-in form (Tabs: "Sign in" / "Create account"). The Google button below it depends on Lovable's `/~oauth/*` broker route, which isn't served on Vercel and 404s.

### Changes (single file: `src/routes/auth.tsx`)

1. Remove the `Continue with Google` button and the "or" divider above it.
2. Remove the `googleSignIn` function.
3. Remove the `import { lovable } from "@/integrations/lovable/index"` import.
4. Update the helper text at the bottom to drop the Google mention, e.g. "Use any email — Gmail, QQ, WeChat email, or your school address."

### Out of scope
- No backend/auth provider changes (Google stays enabled in Cloud but unused from the UI; safe to leave).
- No changes to the email/password flow itself — it's already implemented and working.
- No design system changes.

### Verification
- Open `/auth`, confirm only the Sign in / Create account tabs render with no Google button and no broker call on click.
