import { beforeEach, describe, expect, it, vi } from "vitest"

const prepareLesson = vi.fn()
vi.mock("@workspace/player/prepare", () => ({ prepareLesson }))

const { preparedBundled } = await import("./bundled-lessons")

describe("preparedBundled", () => {
  beforeEach(() => prepareLesson.mockReset())

  it("prepares a bundled lesson once and is null for any other slug", async () => {
    prepareLesson.mockResolvedValue({ math: {}, code: {}, visualsCss: "x" })
    const first = await preparedBundled("button-hierarchy")
    const second = await preparedBundled("button-hierarchy")
    expect(first?.lesson.title).toBeTruthy()
    expect(second).toBe(first)
    expect(prepareLesson).toHaveBeenCalledTimes(1)
    expect(preparedBundled("not-a-lesson")).toBeNull()
  })

  it("doesn't keep a failed preparation: the next request tries again", async () => {
    prepareLesson.mockRejectedValueOnce(new Error("cold start"))
    await expect(preparedBundled("map-vs-foreach")).rejects.toThrow(
      "cold start"
    )
    prepareLesson.mockResolvedValueOnce({ math: {}, code: {}, visualsCss: "" })
    await expect(preparedBundled("map-vs-foreach")).resolves.toMatchObject({
      lesson: { title: expect.any(String) },
    })
    expect(prepareLesson).toHaveBeenCalledTimes(2)
  })
})
