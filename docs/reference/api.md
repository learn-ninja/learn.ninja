---
title: Publish API
description: The HTTP API behind publishing. The CLI uses it; you can too.
---

Base URL: `https://learn.ninja`. Requests and responses are JSON. No account is needed: publishing returns an edit token for that one lesson, and anonymous lessons last 7 days. Signed in, with a session cookie or an API key, lessons are saved to your account and never expire.

## Publish a lesson

```http
POST /api/lessons
Content-Type: application/json
```

The body is the lesson file. A valid lesson returns `201`:

```json
{
  "ok": true,
  "id": "k3x9a2mq",
  "url": "https://learn.ninja/l/how-compound-interest-works-k3x9a2mq",
  "editToken": "…",
  "claimToken": "…",
  "claimUrl": "https://learn.ninja/keep/…",
  "owned": false,
  "expiresAt": "2026-10-26T09:00:00.000Z",
  "spec": "0.4"
}
```

Keep `editToken` private: it's the only way to update the lesson, and it's shown once. `claimToken` is shown once too; it moves the lesson into an account later (see [Keep a lesson](#keep-a-lesson)). With an `x-api-key` header or a session cookie, the lesson belongs to that account from the start: `owned` is `true`, `expiresAt` is `null`, and there's no claim token.

## Update a lesson

```http
PUT /api/lessons/{id}
Content-Type: application/json
Authorization: Bearer <editToken>
```

The body is the new lesson file. The link, the owner, and the expiry stay the same. Returns `200` with the same fields as publishing, without `editToken` or `claimToken`.

## Keep a lesson

```http
POST /api/lessons/{id}/claim
Content-Type: application/json
x-api-key: <key>
```

The body is `{ "claimToken": "…" }` from publishing. Needs a signed-in caller: an API key or a session cookie. The lesson then belongs to that account, stops expiring, and the claim token stops working. Returns `200` with `id`, `url`, `title`, `owned: true`, and `expiresAt: null`; `409 already_claimed` if another account has it; `404` once it has expired.

`claimUrl` from publishing (`/keep/{claimToken}`) does the same thing in the browser: it signs the visitor in, then keeps that one lesson.

## API keys

A key stands for an account on the terminal. `learn login` makes one; you can also make and revoke keys at [learn.ninja/settings](https://learn.ninja/settings). Send it as an `x-api-key` header. A key that doesn't work answers `401 invalid_api_key`, and the request isn't carried out anonymously.

```http
GET /api/account
x-api-key: <key>
```

Returns `{ "ok": true, "email": "…", "handle": "…", "name": "…" }` for the key's account (`learn whoami`). `PATCH /api/account` with `{ "handle": "…" }` sets the handle: 3 to 30 lowercase letters, numbers, and hyphens.

```http
GET /api/keys
POST /api/keys
DELETE /api/keys/{id}
```

List the account's keys (never the keys themselves), make a new one from `{ "name": "…" }` (the only call that returns a key in the clear; it needs a session cookie, not another key), or revoke one. A key may revoke itself.

Sign-in itself goes through [Better Auth](https://better-auth.com)'s routes under `/api/auth/`: `POST /api/auth/email-otp/send-verification-otp` with `{ "email": "…", "type": "sign-in" }` emails a six-digit code, and `POST /api/auth/sign-in/email-otp` with `{ "email": "…", "otp": "…" }` signs in and sets the session cookie. The CLI's `login` command does exactly this.

## Check a lesson

```http
POST /api/validate
Content-Type: application/json
```

The body is the lesson file. Runs the checks publishing runs and stores nothing. A valid lesson returns `200` with `{ "ok": true, "spec": "0.4" }`; an invalid one returns the same errors as publishing. The skill's `validate` command uses this.

## The skill's guides

```http
GET /api/skill
```

The skill's steps, guides, and schema as one JSON bundle: `version` (the current skill), `minVersion` (the oldest skill the guides work with), `hash` (changes whenever a file does), and `files`, a map from path to text. `GET /api/skill/version` returns the same without `files`. The skill's `sync` command uses both.

## Errors

Errors return `"ok": false` with an `error` code and a `message`.

| Status | `error`            | Meaning                                                     |
| ------ | ------------------ | ----------------------------------------------------------- |
| 401    | `unauthorized`     | The edit or claim token doesn't match this lesson           |
| 401    | `sign_in_required` | The call needs a session cookie or an `x-api-key` header    |
| 401    | `invalid_api_key`  | The key was revoked or never existed; run `learn login`     |
| 404    | `not_found`        | The lesson doesn't exist, has expired, or was already kept  |
| 409    | `already_claimed`  | Another account already keeps this lesson                   |
| 409    | `handle_taken`     | Someone already has that handle                             |
| 413    | `too_large`        | The lesson file is too big                                  |
| 422    | `invalid_lesson`   | The lesson breaks the format; the response lists each issue |
| 422    | `invalid_handle`   | The handle breaks the rules or is reserved                  |
| 422    | `unsupported_spec` | The lesson's `spec` version isn't supported                 |
| 429    | `rate_limited`     | Too many publishes from one place; try again later          |

## Limits

- 20 publishes or updates an hour from one place.
- 5 sign-in codes an hour to one email address, 3 a minute from one place; each code works for 5 minutes and three tries.
- Anonymous lessons expire 7 days after they're first published. Owned lessons never expire.
