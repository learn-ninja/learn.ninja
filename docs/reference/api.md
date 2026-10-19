---
title: Publish API
description: The HTTP API behind publishing. The CLI uses it; you can too.
---

Base URL: `https://learn.ninja`. Requests and responses are JSON. There's no account or API key: publishing returns an edit token for that one lesson.

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
  "expiresAt": "2026-10-09T09:00:00.000Z",
  "spec": "0.5"
}
```

Keep `editToken` private: it's the only way to update the lesson, and it's shown once.

## Update a lesson

```http
PUT /api/lessons/{id}
Content-Type: application/json
Authorization: Bearer <editToken>
```

The body is the new lesson file. The link and the expiry stay the same. Returns `200` with the same fields as publishing, without `editToken`.

## Check a lesson

```http
POST /api/validate
Content-Type: application/json
```

The body is the lesson file. Runs the checks publishing runs and stores nothing. A valid lesson returns `200` with `{ "ok": true, "spec": "0.5" }`; an invalid one returns the same errors as publishing. The skill's `validate` command uses this.

## The skill's guides

```http
GET /api/skill
```

The skill's steps, guides, and schema as one JSON bundle: `version` (the current skill), `minVersion` (the oldest skill the guides work with), `hash` (changes whenever a file does), and `files`, a map from path to text. `GET /api/skill/version` returns the same without `files`. The skill's `sync` command uses both.

## Errors

Errors return `"ok": false` with an `error` code and a `message`.

| Status | `error`            | Meaning                                                     |
| ------ | ------------------ | ----------------------------------------------------------- |
| 401    | `unauthorized`     | The edit token doesn't match this lesson                    |
| 404    | `not_found`        | The lesson doesn't exist or has expired                     |
| 413    | `too_large`        | The lesson file is too big                                  |
| 422    | `invalid_lesson`   | The lesson breaks the format; the response lists each issue |
| 422    | `unsupported_spec` | The lesson's `spec` version isn't supported                 |
| 429    | `rate_limited`     | Too many publishes from one place; try again later          |

## Limits

- 20 publishes or updates an hour from one place.
- Lessons expire 24 hours after they're first published.
