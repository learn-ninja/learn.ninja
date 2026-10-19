import { readFileSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"

// The paths a visitor, a learner, and an agent take, end to end.

const example = readFileSync(
  path.join(process.cwd(), "../../examples/compound-interest.json"),
  "utf8"
)

test("the home page explains the product", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Vibe learn"
  )
  await expect(
    page.getByRole("button", { name: "Copy prompt for agent" }).first()
  ).toBeVisible()
})

test("agents get Markdown instead of HTML", async ({ request }) => {
  const res = await request.get("/", { headers: { accept: "text/plain" } })
  expect(res.ok()).toBe(true)
  expect(await res.text()).toMatch(/^# learn\.ninja/)
})

test("a bundled lesson plays", async ({ page }) => {
  await page.goto("/lessons/compound-interest")
  await page.getByRole("button", { name: "Start lesson" }).click()
  await page.getByText("$1,700").click()
  await page.getByRole("button", { name: "Check answer" }).click()
  await expect(
    page.getByText("Not quite, and that's fine").first()
  ).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(
    page.getByRole("heading", { name: "Interest on interest" })
  ).toBeVisible()
})

test("a published lesson opens at its link, and a dead link shows the expired page", async ({
  page,
  request,
}) => {
  const res = await request.post("/api/lessons", {
    headers: { "content-type": "application/json" },
    data: example,
  })
  expect(res.status()).toBe(201)
  const body = (await res.json()) as { url: string; editToken: string }
  expect(body.editToken).toBeTruthy()

  const opened = await page.goto(body.url)
  expect(opened?.status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How compound interest works"
  )
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible()

  // A dead link answers 200 so chat apps and social sites show the expired card.
  const dead = await page.goto("/l/nothing-here-zzzzzzzz")
  expect(dead?.status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "isn't available"
  )
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    "This lesson has expired"
  )
  const image = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content")
  // The URL is absolute (the production site), so fetch its path from the test server.
  const { pathname } = new URL(image!, "http://localhost")
  expect(pathname).toBe("/l/nothing-here-zzzzzzzz/card")
  const card = await request.get(pathname)
  expect(card.status()).toBe(200)
  expect(card.headers()["content-type"]).toBe("image/png")
})
