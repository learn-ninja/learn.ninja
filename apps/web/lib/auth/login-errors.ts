// What a refused GitHub log-in means on the website: Better Auth sends the browser back to
// /login with an `?error=` code (the errorCallbackURL in lib/auth/browser.ts), and the log-in form
// shows this line until the next try.

export function githubLoginError(
  code: string | string[] | undefined
): string | null {
  const value = Array.isArray(code) ? code[0] : code
  if (!value) return null
  switch (value) {
    // The ban in lib/auth/auth.ts's session hook.
    case "ACCOUNT_BANNED":
      return "This account can't log in."
    // GitHub's email belongs to an account that GitHub can't join by itself.
    case "email_not_verified":
    case "unable_to_link_account":
      return "That email already has an account. Log in with a code to it, then connect GitHub in Settings."
    // The person said no on GitHub: nothing went wrong.
    case "access_denied":
      return null
    default:
      return "GitHub didn't log you in. Try again."
  }
}
