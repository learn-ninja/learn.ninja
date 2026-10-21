import { sql } from "drizzle-orm"
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

// The tables, as plans/accounts-v2.md lists them. Ownership, team, and visibility columns exist from
// the start so later phases never migrate live data. After changing this file, run
// `npm run generate -w @workspace/db` and commit the new migration.

export const visibility = pgEnum("visibility", ["public", "unlisted", "team"])

const time = (name: string) => timestamp(name, { withTimezone: true })

/**
 * Raw bytes. Handed to the driver as a Buffer, which Neon over HTTP and PGlite both encode for a
 * bytea parameter; read back as whatever the driver returns (a Buffer, a Uint8Array, or hex text).
 */
const bytea = customType<{ data: Uint8Array; driverData: unknown }>({
  dataType: () => "bytea",
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => {
    if (value instanceof Uint8Array) return value
    if (typeof value === "string" && value.startsWith("\\x"))
      return Buffer.from(value.slice(2), "hex")
    throw new TypeError("Unexpected bytea value from the driver")
  },
})

// ---------- accounts ----------
// Better Auth owns user, session, account, verification, apikey, and the jwks/oauth_* tables below: the property names are the
// field names it expects (its Drizzle adapter reads columns by property), the SQL names are ours.
// We add handle, bio, and banned to user.

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** The public name in /u/{handle}. GitHub users get their login; email users pick one. */
    handle: text("handle"),
    bio: text("bio"),
    /** Flipped by hand; a banned user can't log in. */
    banned: boolean("banned").notNull().default(false),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_email_idx").on(t.email),
    uniqueIndex("user_handle_idx").on(t.handle),
  ]
)

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: time("expires_at").notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("session_token_idx").on(t.token),
    index("session_user_id_idx").on(t.userId),
  ]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: time("access_token_expires_at"),
    refreshTokenExpiresAt: time("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)]
)

/** Email codes (hashed) and OAuth state. */
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: time("expires_at").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
)

/** The terminal's keys (`learn login`). Only the hash is stored; `start` shows the first characters. */
export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    /** The user the key belongs to. */
    referenceId: text("reference_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: time("last_refill_at"),
    enabled: boolean("enabled").notNull().default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").notNull().default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86_400_000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").notNull().default(0),
    remaining: integer("remaining"),
    lastRequest: time("last_request"),
    expiresAt: time("expires_at"),
    createdAt: time("created_at").notNull(),
    updatedAt: time("updated_at").notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (t) => [
    index("apikey_key_idx").on(t.key),
    index("apikey_reference_id_idx").on(t.referenceId),
    index("apikey_config_id_idx").on(t.configId),
  ]
)

// ---------- OAuth provider (chat apps logging in through MCP) ----------
// Better Auth's jwt and oauth-provider plugins own these: property names are their field names,
// SQL names are ours. `string[]` fields are text arrays, `json` fields are jsonb, as Better Auth's
// own generator writes them for Postgres.

/** The signing keys behind MCP access tokens (private keys encrypted with BETTER_AUTH_SECRET). */
export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: time("created_at").notNull(),
  expiresAt: time("expires_at"),
  alg: text("alg"),
  crv: text("crv"),
})

/** An OAuth client: a chat app that logged in (by Client ID Metadata Document or registration). */
export const oauthClient = pgTable(
  "oauth_client",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    clientCredentialsScopes: text("client_credentials_scopes")
      .array()
      .default(sql`'{}'::text[]`),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean(
      "backchannel_logout_session_required"
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (t) => [index("oauth_client_user_id_idx").on(t.userId)]
)

/** A protected resource tokens are issued for: the MCP server. Seeded from the plugin's config. */
export const oauthResource = pgTable("oauth_resource", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean(
    "dpop_bound_access_tokens_required"
  ).default(false),
  disabled: boolean("disabled").default(false),
  createdAt: time("created_at"),
  updatedAt: time("updated_at"),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
})

/** Which clients may request which resources. */
export const oauthClientResource = pgTable(
  "oauth_client_resource",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: time("created_at"),
  },
  (t) => [
    index("oauth_client_resource_client_id_idx").on(t.clientId),
    index("oauth_client_resource_resource_id_idx").on(t.resourceId),
    uniqueIndex("oauth_client_resource_pair_idx").on(t.clientId, t.resourceId),
  ]
)

/** A refresh token (hashed), issued with `offline_access` so a chat app stays logged in. */
export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    expiresAt: time("expires_at").notNull(),
    createdAt: time("created_at").notNull(),
    revoked: time("revoked"),
    rotatedAt: time("rotated_at"),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: time("rotation_replay_expires_at"),
    authTime: time("auth_time"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (t) => [
    uniqueIndex("oauth_refresh_token_token_idx").on(t.token),
    index("oauth_refresh_token_client_id_idx").on(t.clientId),
    index("oauth_refresh_token_session_id_idx").on(t.sessionId),
    index("oauth_refresh_token_user_id_idx").on(t.userId),
    index("oauth_refresh_token_authorization_code_id_idx").on(
      t.authorizationCodeId
    ),
  ]
)

/** An access token's record (hashed), so it can be revoked and introspected. */
export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
      onDelete: "set null",
    }),
    expiresAt: time("expires_at").notNull(),
    createdAt: time("created_at").notNull(),
    revoked: time("revoked"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (t) => [
    uniqueIndex("oauth_access_token_token_idx").on(t.token),
    index("oauth_access_token_client_id_idx").on(t.clientId),
    index("oauth_access_token_session_id_idx").on(t.sessionId),
    index("oauth_access_token_user_id_idx").on(t.userId),
    index("oauth_access_token_authorization_code_id_idx").on(
      t.authorizationCodeId
    ),
    index("oauth_access_token_refresh_id_idx").on(t.refreshId),
  ]
)

/** What a user allowed a client to do: the consent screen's answer, kept so it's asked once. */
export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    scopes: text("scopes").array().notNull(),
    createdAt: time("created_at").notNull(),
    updatedAt: time("updated_at").notNull(),
  },
  (t) => [
    index("oauth_consent_client_id_idx").on(t.clientId),
    index("oauth_consent_user_id_idx").on(t.userId),
  ]
)

/** A used `private_key_jwt` assertion id, kept until it expires so it can't be replayed. */
export const oauthClientAssertion = pgTable("oauth_client_assertion", {
  id: text("id").primaryKey(),
  expiresAt: time("expires_at").notNull(),
})

/**
 * A profile picture, as uploaded through settings and resized to one small WebP. Each upload gets
 * a fresh id, so its URL (/avatars/{id}, kept in user.image) can be cached forever; replacing or
 * removing the picture deletes the row.
 */
export const avatar = pgTable(
  "avatar",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    data: bytea("data").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("avatar_user_id_idx").on(t.userId)]
)

// ---------- lessons ----------

export const lesson = pgTable(
  "lesson",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    spec: text("spec").notNull(),
    lesson: jsonb("lesson").notNull(),
    /** Formulas, code, and visuals CSS, prepared once at publish time. */
    prepared: jsonb("prepared").notNull(),
    editTokenHash: text("edit_token_hash").notNull(),
    /** Null once the lesson is claimed into an account. */
    claimTokenHash: text("claim_token_hash"),
    /** Null for anonymous lessons. */
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Reserved for teams. */
    orgId: text("org_id"),
    visibility: visibility("visibility").notNull().default("unlisted"),
    hidden: boolean("hidden").notNull().default(false),
    /** The column keeps its first name, plays: renaming it would break the deployment still serving while the next one migrates. */
    views: integer("plays").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    /** Null means it never expires (owned lessons). */
    expiresAt: time("expires_at"),
  },
  (t) => [
    index("lesson_expires_at_idx").on(t.expiresAt),
    index("lesson_listing_idx").on(t.visibility, t.hidden, t.createdAt),
    // Explore filtered by subject: the subject is read from the JSON (spec 0.6), so the index is on
    // that expression, joined with the listing columns. No column, so a publish stays one row write.
    index("lesson_subject_idx").on(
      sql`(${t.lesson}->>'subject')`,
      t.visibility,
      t.hidden,
      t.createdAt
    ),
    index("lesson_claim_token_hash_idx").on(t.claimTokenHash),
    index("lesson_owner_id_idx").on(t.ownerId),
  ]
)

/**
 * A lesson's tags, one row each, for counting and filtering. Rebuilt from the lesson JSON on every
 * publish and update (the JSON stays the truth; this is an index), and gone with the lesson.
 */
export const lessonTag = pgTable(
  "lesson_tag",
  {
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    /** The tag's key (`claude-code`), derived from the label; what counts and filters compare. */
    tag: text("tag").notNull(),
    /** The label as this lesson wrote it ("Claude Code"); the report shows the most common one per key. */
    label: text("label").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.lessonId, t.tag] }),
    index("lesson_tag_tag_idx").on(t.tag),
  ]
)

// ---------- Explore ----------

/** One like per user per lesson; `lesson.likes` keeps the count. */
export const like = pgTable(
  "like",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    index("like_lesson_id_idx").on(t.lessonId),
  ]
)

/** A lesson the user played to its wrap-up, first time only: Explore marks it with a check. */
export const completion = pgTable(
  "completion",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    completedAt: time("completed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })]
)

/** A report on a lesson, emailed to the maker when it's made. The reporter is kept only as a hash of their IP. */
export const report = pgTable(
  "report",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    reporterIpHash: text("reporter_ip_hash").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("report_lesson_id_idx").on(t.lessonId)]
)

// ---------- drafts ----------

/**
 * Lessons an MCP client sent to validate_lesson or publish_lesson, kept for a day so the model can
 * fix them with small patches (or publish a checked one) instead of sending the whole file again.
 * The id is a random secret the tool returns; anyone holding it could only publish the draft.
 */
export const lessonDraft = pgTable(
  "lesson_draft",
  {
    id: text("id").primaryKey(),
    /** The lesson file's text, as sent or as patched. */
    text: text("text").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    expiresAt: time("expires_at").notNull(),
  },
  (t) => [index("lesson_draft_expires_at_idx").on(t.expiresAt)]
)
