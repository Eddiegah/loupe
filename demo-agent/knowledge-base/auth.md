# Authentication

Every request must include an API key in the `Authorization` header, using the
`Bearer` scheme:

```
Authorization: Bearer sk_live_...
```

API keys are scoped to a single account and can be rotated at any time from
the dashboard under Settings > API Keys. Rotating a key immediately
invalidates the old one - there is no overlap window, so update all clients
before rotating.

Requests with a missing or malformed `Authorization` header are rejected with
`401 Unauthorized`. Requests with a well-formed but revoked or expired key are
also rejected with `401 Unauthorized` - the API does not distinguish "missing"
from "invalid" in the response body, to avoid leaking which keys are valid.

Authentication only proves *who* is calling - it does not by itself grant
permission to perform every action. See Error Codes for the distinction
between an authentication failure (401) and a permissions failure (403).
