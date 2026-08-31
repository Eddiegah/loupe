# Error Codes

| Code | Meaning | When it happens |
| --- | --- | --- |
| 400 | Bad Request | The request body is malformed or fails validation (e.g. missing a required field). |
| 401 | Unauthorized | The `Authorization` header is missing, malformed, or the API key is invalid/revoked. This is about **who you are** - the API could not authenticate you at all. |
| 403 | Forbidden | You were authenticated successfully, but your API key does not have permission to perform this action (e.g. a restricted key trying to issue a refund). This is about **what you're allowed to do**, not who you are. |
| 404 | Not Found | The resource doesn't exist, or exists on a different account. The API deliberately does not distinguish these two cases. |
| 409 | Conflict | The request conflicts with existing state (e.g. creating a user with an email that's already in use). |
| 429 | Too Many Requests | You've exceeded the rate limit. See the `Retry-After` header. |
| 500 | Internal Server Error | Something went wrong on our end. These are logged automatically; if one persists, contact support with the request id from the `X-Request-Id` response header. |

The most commonly confused pair is **401 vs 403**: 401 means the API doesn't
know who you are (bad or missing credentials); 403 means it knows exactly who
you are and the answer is still no (insufficient permissions on an otherwise
valid key).
