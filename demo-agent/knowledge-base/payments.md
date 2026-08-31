# Payments API

## Create a charge

`POST /v1/charges`

```json
{ "amount": 2000, "currency": "usd", "user_id": "usr_123" }
```

`amount` is always in the smallest currency unit (cents for USD), matching
the convention used across this API.

## Idempotency

Include an `Idempotency-Key` header on any `POST /v1/charges` request. If a
request with the same key is received again within 24 hours, the original
response is returned unchanged and the charge is not created a second time.
This is the only supported way to safely retry a charge after a timeout or
network error - retrying without an idempotency key risks a duplicate charge.

## Refunds

`POST /v1/charges/{id}/refunds` - refunds can be partial (pass an `amount`
less than the original charge) or full (omit `amount`). A charge can be
refunded multiple times up to its original amount.
