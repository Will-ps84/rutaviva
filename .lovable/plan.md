
# Fix: Duplicate Key Error in Company Creation

## Problem Analysis

The current flow has a race condition:
1. User creates company via INSERT
2. Database trigger `handle_company_created` fires and creates admin role
3. Frontend code ALSO tries to create admin role - causing duplicate key error

The network logs confirm this sequence - company (201), profile update (204), then user_roles (409 conflict).

## Current State (Good News!)

Your data is actually complete:
- Company: "Familia sac" (id: 8ec2ccc8-...)
- Profile: company_id is set correctly
- Role: admin role exists in user_roles

**Immediate fix**: Refresh the page - you should see your company.

---

## Code Fix for Future Users

### File: `src/hooks/useCompany.ts`

**Change**: Remove the user_roles INSERT logic from frontend - let the database trigger handle it exclusively.

```typescript
// BEFORE (causes duplicate)
// Step 3: Create admin role
const { error: roleError } = await supabase
  .from('user_roles')
  .insert({...});

// AFTER (let trigger handle it)
// Remove Step 3 entirely - trigger handles role creation
```

**Updated mutation function:**
```typescript
mutationFn: async (name: string) => {
  if (!user) throw new Error('Usuario no autenticado');
  
  // Step 1: Create company (trigger auto-handles profile + role)
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({ name })
    .select()
    .single();
  
  if (companyError) {
    throw new Error(`Error creando empresa: ${companyError.message}`);
  }
  
  // Step 2: Refresh session to get updated claims
  await supabase.auth.refreshSession();
  
  return company;
}
```

### File: `src/components/company/CompanySetupCard.tsx`

**Change**: After success, navigate to `/app/routes` instead of just reloading.

```typescript
import { useNavigate } from 'react-router-dom';

// In component:
const navigate = useNavigate();

// In handleSubmit success callback:
onSuccess: () => {
  setVisibleError(null);
  navigate('/app/routes');
  // Or use window.location.href = '/app/routes' for full reload
}
```

---

## Implementation Steps

1. **Update `useCompany.ts`**: Remove Steps 2 and 3 (profile update and role creation) - the trigger handles both
2. **Update `CompanySetupCard.tsx`**: Add navigation to `/app/routes` on success
3. **Test**: Create new user, create company, verify redirect works

---

## Technical Details

### Why the trigger is sufficient:

The `handle_company_created()` trigger already:
- Updates `profiles.company_id`
- Inserts into `user_roles` with `ON CONFLICT DO NOTHING`

### Files to modify:
| File | Change |
|------|--------|
| `src/hooks/useCompany.ts` | Remove profile update + role creation (lines 62-80) |
| `src/components/company/CompanySetupCard.tsx` | Add `useNavigate` and redirect to `/app/routes` |

### Verification checklist:
- [ ] Refresh current page - company should appear
- [ ] New users can create company without errors
- [ ] After creation, user lands on `/app/routes`
- [ ] Profile and role are correctly set by trigger

