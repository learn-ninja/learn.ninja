// The pure parts of logging in with GitHub (github-sign-in.ts): where the sign-in sheet ends, what
// it brings back, and which iPhones can take it. The server's side is apps/web/lib/auth/app-github.ts.

/** The app's URL scheme (app.config.ts), where a development build's log-in ends. */
const DEV_CALLBACK = "learnninja://app/signed-in"

/**
 * Where the sheet ends, as the server sends it (appCallbackURL in app-github.ts): the site's own
 * https page, which the site's webcredentials association gives to this app alone, or the app's
 * scheme against a local http server.
 */
export function callbackURLFor(base: string): string {
  const url = new URL(base)
  return url.protocol === "https:"
    ? `${url.origin}/app/signed-in`
    : DEV_CALLBACK
}

export type Ending =
  { kind: "code"; code: string } | { kind: "error" } | { kind: "unexpected" }

/** What the URL the sheet ended on says: a code to redeem, GitHub's refusal, or neither. */
export function endingOf(url: string, expected: string): Ending {
  let got: URL
  let want: URL
  try {
    got = new URL(url)
    want = new URL(expected)
  } catch {
    return { kind: "unexpected" }
  }
  const at = (u: URL) => `${u.protocol}//${u.host}${u.pathname}`
  if (at(got) !== at(want)) return { kind: "unexpected" }
  if (got.searchParams.has("error")) return { kind: "error" }
  const code = got.searchParams.get("code")
  return code ? { kind: "code", code } : { kind: "unexpected" }
}

/**
 * Whether this iPhone can end the sheet on an https page: iOS 17.4 and later
 * (ASWebAuthenticationSession's https callback). A development build ends on the app's scheme,
 * which every version takes. `version` is Platform.Version, "17.4.1" on iOS.
 */
export function canUseGitHub(version: string | number, base: string): boolean {
  if (!base.startsWith("https:")) return true
  const [major = 0, minor = 0] = String(version).split(".").map(Number)
  return major > 17 || (major === 17 && minor >= 4)
}

/** Bytes as base64url with no padding, as PKCE's verifier and challenge are written. */
export function base64url(bytes: Uint8Array): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i]!, bytes[i + 1], bytes[i + 2]]
    out += abc[a >> 2]
    out += abc[((a & 3) << 4) | ((b ?? 0) >> 4)]
    if (b !== undefined) out += abc[((b & 15) << 2) | ((c ?? 0) >> 6)]
    if (c !== undefined) out += abc[c & 63]
  }
  return out
}

/** Standard base64 (expo-crypto's digest) as base64url with no padding. */
export const toBase64url = (base64: string) =>
  base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
