# Users API

## Create a user

`POST /v1/users`

```json
{ "email": "person@example.com", "name": "Jordan Lee" }
```

Returns the created user object, including a server-assigned `id`. Creating a
user with an email that already exists returns `409 Conflict`.

## Retrieve a user

`GET /v1/users/{id}`

Returns `404 Not Found` if no user with that id exists on this account. Users
belonging to a different account always return `404`, never `403` - the API
does not confirm or deny the existence of resources outside your account.

## Update a user

`PATCH /v1/users/{id}` with a partial JSON body of the fields to change.

## Delete a user

`DELETE /v1/users/{id}` - this is a soft delete. The user record is retained
for 30 days (for audit and support purposes) before being permanently purged,
and cannot be un-deleted via the API during that window.
