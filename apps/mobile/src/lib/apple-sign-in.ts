import * as AppleAuthentication from "expo-apple-authentication"
import * as Crypto from "expo-crypto"

import { appleIdToken, cancelledApple } from "./apple-credential"
import { authClient } from "./auth-client"

// Sign in with Apple, natively: iOS's own sheet gives an identity token that Apple signed for this
// app's bundle ID, and Better Auth's /sign-in/social checks it and answers with a session (the
// expo plugin keeps its cookie and skips the browser for an idToken sign-in). A one-time nonce
// from the server (apps/web/lib/auth/app-apple.ts) ties the token to this sign-in: its SHA-256 goes
// to Apple, which puts it in the token, and the nonce itself goes back to the server, which spends
// it and hashes it to compare, so a captured token can't be used again.

export type AppleResult = "signed-in" | "cancelled" | "failed"

export async function logInWithApple(): Promise<AppleResult> {
  const issued = await authClient
    .$fetch<{ nonce: string }>("/app/apple/nonce", { method: "POST" })
    .catch(() => ({ data: null }))
  const nonce = issued.data?.nonce
  if (!nonce) return "failed"
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  )
  let credential: AppleAuthentication.AppleAuthenticationCredential
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    })
  } catch (error) {
    return cancelledApple(error) ? "cancelled" : "failed"
  }
  const idToken = appleIdToken(credential, nonce)
  if (!idToken) return "failed"
  const { error } = await authClient.signIn
    .social({ provider: "apple", idToken })
    .catch(() => ({ error: {} }))
  return error ? "failed" : "signed-in"
}
