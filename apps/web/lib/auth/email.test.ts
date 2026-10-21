import { describe, expect, it, vi } from "vitest"

import { codeSenderFromEnv } from "./email"

describe("codeSenderFromEnv", () => {
  const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv

  it("prints the code to the console without a Resend key, outside production", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    try {
      await codeSenderFromEnv(env({ NODE_ENV: "test" }))("a@example.com", "123456")
      expect(log).toHaveBeenCalledWith(expect.stringContaining("123456"))
    } finally {
      log.mockRestore()
    }
  })

  it("refuses to send in production without a Resend key, and logs no code", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    try {
      await expect(
        codeSenderFromEnv(env({ NODE_ENV: "production" }))("a@example.com", "123456")
      ).rejects.toThrow(/RESEND_API_KEY/)
      expect(log).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })
})
