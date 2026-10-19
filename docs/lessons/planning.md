---
title: Planning
description: How the agent sizes a lesson, when it splits a topic into a path, and when it asks before writing.
---

Before writing, the agent reads what you asked for and decides how big the lesson is, who reads it, and its [level](#pick-a-level). Most requests say enough, so it decides without asking and tells you its choices after publishing, in one line like "Beginner · standard · adult". Ask for any of them to change and it remakes the lesson.

## When the agent asks first

Only when the request is just a topic, with nothing else to go on: "how vaccines work", "teach me budgeting". Then it sends one short message with up to two questions, each with the default it would use:

> Before I make it:
> 1. Who's it for: you, a child (what age?), or a group? (I'll assume you.)
> 2. How long: quick (3–5 min), standard (5–10), or in depth (10–15)? (I'll assume standard.)

Answer in a few words, or say "go" for the defaults. One clear signal is enough to skip the questions: "a quick one on vaccines" or "for my 8-year-old". It never asks for your level: people rate their own level poorly, but they know who a lesson is for.

## Lesson sizes

The size comes from how much the input covers, or from your words: "quick one" or "brief" for short, "deep dive" or "in depth" for long. Every size keeps the same rhythm: a hook, then each concept followed by 2–4 questions, a challenge, and takeaways.

| Size       | When                                                           | Shape                                  | Minutes |
| ---------- | -------------------------------------------------------------- | -------------------------------------- | ------- |
| `short`    | One term, rule, or fact; a refresher                           | 1 concept, 3–4 questions               | 3–5     |
| `standard` | One idea with two or three parts. The default.                 | 2–3 concepts, 2–4 questions after each | 5–10    |
| `long`     | One idea with four parts that only make sense together         | 4 concepts, 2–3 questions after each   | 10–15   |

## Paths

A topic with several ideas that each deserve teaching becomes a path: 2–6 lessons, simple to complex, each a complete lesson of its own. Think Nielsen's 10 heuristics, the Gestalt principles, or a long docs page with separate topics.

The agent plans the whole path, then makes and publishes only lesson 1, and lists the rest. Ask for the next one when you're ready: spreading lessons over several sessions teaches more than doing them back to back. It keeps the plan in a `path.md` file next to the lessons, each lesson in its own folder with its own link.

Each lesson's link expires 7 days after it's published, like any lesson, so an earlier lesson in a path may be gone by the time you finish a later one.

If you ask for one lesson on something big, you get one lesson on its central idea, with the rest named as follow-ups.

## Reading age

Who reads a lesson is separate from how much they know. Lessons are written for adults unless you mention a child or an age under about 13 ("for my kid", "my 7-year-old", "a class of third graders"). A child's lesson is beginner level unless you say otherwise, with short sentences, everyday words, examples from a child's world (school, games, pets, food), and simple, bright visuals.

"Explain like I'm 5" or "in simple terms" from an adult gives a beginner lesson for an adult: plain words and everyday examples, with no talking down.

The skill's full rules are in `reference/planning.md`.
