# Levels

A lesson's `level` says who it's for. It changes what the lesson assumes, how hard the questions are, and how much help they give. It doesn't change the shape: every level has the same hook, concepts with 2–4 question bricks each, challenge, and takeaways, within the same limits. The size (`reference/planning.md`) sets how many concepts.

## Pick the level

Go down this list and stop at the first signal you find:

1. **An audience the user names.** A named level, or who it's for: "for my kid" or "for people new to statistics" is `beginner`; "for my team of senior engineers" is `advanced`.
2. **How the request is worded.** Terms of art, a named method, or stated background ("I already use flexbox; teach me grid areas") point up. So do "refresher", "brush up on", "remind me", and "review": the learner has met the idea before, so the lesson is at least `intermediate` and spends its words on what's easy to forget, not on first definitions. A plain "explain X", "how does X work", or "what is X" points to `beginner`, however advanced X is: people who ask that way are usually new to it. "Explain like I'm 5" and "in simple terms" are `beginner` too. The table in `reference/planning.md` lists more of the words people use for each.
3. **What the source assumes**, when the user gives you a document. Text that explains its own terms is `beginner` or `intermediate`; text written for people already in the field, like a framework's API reference or a standard's specification, is `intermediate` or `advanced`.
4. **How deep the topic is**, only to break a tie: a topic that needs several other ideas first leans up.
5. **If still unclear, `beginner`.**

| Request | Level |
| --- | --- |
| "What is a budget?" | `beginner` |
| "How do black holes form?" | `beginner`: an advanced topic asked in plain words |
| "How the Kalman gain trades off process and measurement noise" | `advanced`: terms of art |
| "Solve quadratics by completing the square" | `intermediate`: a named method that assumes algebra |
| "Brush up on SQL joins" | `intermediate`: met before, needs the details back |
| A link to a database's documentation on index types | `intermediate`: the page assumes the reader builds software |
| "Telling the time, for my 6-year-old" | `beginner`, child reading age (`reference/planning.md`) |

Tell the user which level you chose, and that you can remake the lesson at another.

Levels are relative to the subject, so each file says what to assume. Lessons drift to the middle: beginner lessons pick up jargon, advanced lessons re-teach the basics. Each file ends with a check for that.

| Level          | For                                             | Guide                    |
| -------------- | ----------------------------------------------- | ------------------------ |
| `beginner`     | Never done this, or only a little               | `levels/beginner.md`     |
| `intermediate` | Knows the basics; wants to use them             | `levels/intermediate.md` |
| `advanced`     | Significant prior learning; analyses and judges | `levels/advanced.md`     |
