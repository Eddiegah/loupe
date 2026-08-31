# Webhooks

Subscribe to events (`user.created`, `charge.succeeded`, `charge.refunded`,
etc.) from the dashboard under Settings > Webhooks by providing a URL and
selecting event types.

## Verifying a webhook request

Every webhook request includes an `X-Signature` header. To verify a request
actually came from us (and not an attacker who guessed your endpoint URL):

1. Take the raw, unparsed request body.
2. Compute an HMAC-SHA256 signature of that body using your account's
   webhook signing secret (found under Settings > Webhooks) as the key.
3. Compare the resulting hex digest to the value of the `X-Signature` header
   using a constant-time comparison.
4. Reject the request (respond with any non-2xx status) if they don't match.

Do not trust a webhook request that fails this check, even if it otherwise
looks legitimate.

## Retry policy

If your endpoint doesn't respond with a `2xx` status within 10 seconds,
delivery is retried with exponential backoff: after 1 minute, 5 minutes,
30 minutes, then every 2 hours up to 24 hours, after which the event is
marked as permanently failed and is visible in the dashboard's webhook log.
