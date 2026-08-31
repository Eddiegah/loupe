# Rate Limits

The default tier allows **100 requests per minute** per API key, measured on
a sliding 60-second window. Higher tiers are available on request.

When you exceed the limit, the API returns `429 Too Many Requests` with a
`Retry-After` header giving the number of seconds to wait before the next
request is likely to succeed.

Rate limits are per API key, not per account - if you use separate keys for
different services, each gets its own 100-requests-per-minute budget.

Bulk operations (bulk user import, bulk refunds) count as a single request
against the rate limit regardless of how many records they contain, but are
capped at 500 records per call.
