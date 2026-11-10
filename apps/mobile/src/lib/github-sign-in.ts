import * as Crypto from "expo-crypto"
import * as WebBrowser from "expo-web-browser"

import { authClient } from "./auth-client"
import { API_BASE_URL } from "./config"
import {
  base64url,
  callbackURLFor,
  endingOf,
  toBase64url,
} from "./github-callback"

// Logging in with GitHub (apps/web/lib/auth/app-github.ts has the whole flow): a random verifier
// stays in the app, its SHA-256 goes to the server in the system's sign-in sheet, GitHub logs in
// there, and the sheet comes back with a one-time code that only this verifier redeems for a
// session. Not Better Auth's own social sign-in for Expo, whose proxy the server keeps off.

export type GitHubResult = "signed-in" | "cancelled" | "failed"

export async function logInWithGitHub(): Promise<GitHubResult> {
  const verifier = base64url(Crypto.getRandomBytes(32))
  const challenge = toBase64url(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      {
        encoding: Crypto.CryptoEncoding.BASE64,
      }
    )
  )
  const callback = callbackURLFor(API_BASE_URL)
  const result = await WebBrowser.openAuthSessionAsync(
    `${API_BASE_URL}/api/auth/app/github/start?challenge=${challenge}`,
    callback,
    // The https callback, matched by host and path, needs this (iOS 17.4 and later).
    { preferUniversalLinks: true }
  )
  if (result.type !== "success") return "cancelled"
  const ending = endingOf(result.url, callback)
  if (ending.kind !== "code") return "failed"
  // The expo plugin keeps the session cookie this answers with, and tells the app it's signed in.
  const { error } = await authClient
    .$fetch("/app/github/redeem", {
      method: "POST",
      body: { code: ending.code, verifier },
    })
    .catch(() => ({ error: {} }))
  return error ? "failed" : "signed-in"
}
