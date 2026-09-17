# API Validation

## The `guarded()` Pattern

Every route handler wraps its logic in `guarded()` from `lib/api.ts`:

```typescript
import { guarded, ok, invalid } from "@/lib/api";

export async function GET(request: NextRequest) {
  return guarded(async () => {
    const parsed = parseSearchParams(schema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    // ... business logic ...
    return ok(result);
  });
}
```

`guarded()` catches unhandled errors and returns a 500 with a safe error message. It never leaks stack traces to the client.

## Zod Schemas

Every API input boundary uses Zod for validation. Schemas are defined inline or in `lib/validators/`.

```typescript
const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["meditation", "pranayama", "nidra", "abhyanga"]),
  durationSeconds: z.number().int().min(1),
});
```

### `parseSearchParams()`

A utility in `lib/validators/` that parses URL search params through a Zod schema:

```typescript
const parsed = parseSearchParams(schema, request.nextUrl.searchParams);
if (!parsed.success) return invalid(parsed.error);
const { date, kind } = parsed.data;
```

### `parseBody()`

For POST/PATCH requests:

```typescript
const parsed = await parseBody(schema, request);
if (!parsed.success) return invalid(parsed.error);
```

## Error Responses

Validation errors return 400 with the Zod issue array:

```json
{
  "ok": false,
  "error": "Validation failed",
  "details": [
    { "path": ["date"], "message": "Required" }
  ]
}
```

Server errors return 500 with a generic message (never the actual error).
