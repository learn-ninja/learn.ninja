import type { Voices } from "../../voices"

// The ninja's English lines. He's one Japanese sensei in three moods: Sensei, the calm dojo teacher of
// few words (the default); Casual, the same teacher off duty; and Unhinged, a frantic ninja who panics
// at the situation, never at the learner. Plain lines and flavor lines take turns (CADENCE in
// voices.ts). Every line is at most 32 characters and 6 words, so it fits one line of the feedback
// toast at the largest text size and takes about a second to say, and ends in punctuation. The other
// languages in this folder write theirs afresh in their own idiom.

export const en: Voices = {
  casual: {
    praise: {
      plain: ["Correct.", "That's right.", "Yes, that's it.", "Right answer."],
      flavor: [
        "Yosh! Nice work.",
        "Spot on.",
        "Nailed it.",
        "Clean hit!",
        "You got it.",
        "That's the one.",
        "Sharp eye.",
        "Good thinking.",
        "Smooth.",
        "Right on target.",
        "Easy, right?",
        "Like a pro.",
        "Just right.",
        "Bullseye.",
        "There you go.",
        "Sugoi! Correct.",
      ],
    },
    correctWithHint: {
      plain: ["Correct, with a hint.", "Right, with a little help."],
      flavor: [
        "The hint did its job.",
        "Hint plus you. Nice team.",
        "A nudge, then nailed it.",
        "Got there with a hint.",
        "That's what hints are for.",
        "Nicely worked out.",
      ],
    },
    goodGuess: {
      plain: ["Good guess!", "Right on the first guess."],
      flavor: [
        "Nice instinct.",
        "Your gut was right.",
        "Good call.",
        "Ninja instincts!",
        "Sharp guess.",
        "Trust that instinct.",
      ],
    },
    hookMiss: {
      plain: ["Not quite, and that's fine.", "Not this time. Read on."],
      flavor: [
        "Good try. Let's find out why.",
        "Fair guess. Here's the twist.",
        "Most people pick that one.",
        "That's why we're here.",
        "Hold that thought.",
        "No worries. It's a warm-up.",
      ],
    },
    nudge: {
      plain: [
        "Not quite. Take another look.",
        "Not that one. Try again.",
        "Almost. One more try.",
      ],
      flavor: [
        "Almost. Have another go.",
        "One more look should do it.",
        "Close. Give it another shot.",
        "Not yet. You've got this.",
        "Hmm, try a different one.",
        "Take a breath. Try again.",
        "Not it. Look a bit closer.",
        "Another go? You're close.",
        "Missed. Reset and swing.",
        "Off target. Aim again.",
      ],
    },
    close: {
      plain: ["Close, but not the best.", "Good, but one fits better."],
      flavor: [
        "Nearly. One fits better.",
        "Almost the best pick.",
        "Solid, but look again.",
        "Close. There's a better one.",
        "Good aim, slightly off.",
      ],
    },
    answer: {
      plain: ["Here's the answer.", "Let's see the answer."],
      flavor: [
        "Here's how it works.",
        "Tricky one. Here it is.",
        "Let's look at the answer.",
        "Now you'll know next time.",
        "Here's the trick.",
      ],
    },
    streak: {
      plain: ["Three in a row.", "That's three straight."],
      flavor: [
        "On a roll.",
        "Hot streak!",
        "Keep it going.",
        "Three for three. Yosh!",
        "Combo!",
      ],
    },
    comeback: {
      plain: ["There it is.", "Got it on the retry."],
      flavor: [
        "Got it this time.",
        "Good recovery.",
        "Second try, nailed.",
        "That's the comeback.",
        "Worth the second look.",
      ],
    },
    last: {
      plain: ["Last one, and it's right.", "Final answer: correct."],
      flavor: [
        "That's the lesson.",
        "Finished strong.",
        "What a finish.",
        "And that's a wrap.",
        "Bow out. Nice work.",
      ],
    },
  },
  sensei: {
    praise: {
      plain: ["Good.", "Yes.", "Correct.", "Hai. Correct."],
      flavor: [
        "Clean strike.",
        "You saw it.",
        "No wasted motion.",
        "Well seen.",
        "Like water. Good.",
        "The blade is sharp.",
        "Your eye is sharpening.",
        "Simple. Correct.",
        "Steady and true.",
        "As it should be.",
        "Calm mind, right answer.",
        "A student who sees.",
        "The bamboo bends. Good.",
        "Strong form.",
        "You are learning.",
        "One cut. Enough.",
      ],
    },
    correctWithHint: {
      plain: ["Good. The hint helped.", "Correct, with help."],
      flavor: [
        "Asking is also practice.",
        "Even masters take hints.",
        "The hint opened the door.",
        "Help first, then your hands.",
        "A guide is no shame.",
        "Next time, without it.",
      ],
    },
    goodGuess: {
      plain: ["A good guess.", "Instinct served you."],
      flavor: [
        "Instinct first. Now the reason.",
        "Hands knew before the head.",
        "The body learns first.",
        "A ninja trusts the gut.",
        "Now learn why it's right.",
        "Guessed well. Let's see why.",
      ],
    },
    hookMiss: {
      plain: ["Not yet. We begin here.", "Not yet. Watch."],
      flavor: [
        "Every path starts here.",
        "Wrong is a beginning.",
        "An empty cup. Good.",
        "A white belt starts here.",
        "No matter. Watch.",
        "Now we can learn.",
      ],
    },
    nudge: {
      plain: ["Not yet. Again.", "Look again.", "Again."],
      flavor: [
        "Slower.",
        "Breathe. Then look.",
        "Patience. Again.",
        "Again. It's there.",
        "The answer waits. Find it.",
        "Still your mind. Try.",
        "Read it once more.",
        "Closer. Again.",
        "Kata are repeated. Again.",
        "Fall seven, rise eight.",
      ],
    },
    close: {
      plain: ["Close. One is better.", "Near. Not the best."],
      flavor: [
        "Good is not best.",
        "One cuts cleaner.",
        "Find the sharper blade.",
        "Good eye. Not the best yet.",
        "Look for the better path.",
      ],
    },
    answer: {
      plain: ["Here is the answer.", "Watch closely now."],
      flavor: [
        "Watch, then see it yourself.",
        "Hard ones teach the most.",
        "Study this one.",
        "Learn its shape.",
        "Read it slowly.",
      ],
    },
    streak: {
      plain: ["Three in a row. Steady.", "Three. Good rhythm."],
      flavor: [
        "Calm hands.",
        "Flowing now.",
        "Keep the rhythm.",
        "Steady as stone.",
        "The dojo notices.",
      ],
    },
    comeback: {
      plain: ["You looked again. There it is.", "Second look. Correct."],
      flavor: [
        "Fall, then rise.",
        "The second look is the lesson.",
        "Patience rewarded.",
        "That is practice.",
        "This is how we grow.",
      ],
    },
    last: {
      plain: ["That's the lesson. Well done.", "The lesson is complete."],
      flavor: [
        "You finished what you began.",
        "Bow. The lesson is done.",
        "A clean ending.",
        "Rest now. You earned it.",
        "The last step counts too.",
      ],
    },
  },
  unhinged: {
    praise: {
      plain: [
        "Correct. Breathe.",
        "It's right. Nobody panic.",
        "Correct! Phew.",
        "Right. My heart, though.",
      ],
      flavor: [
        "I almost threw a smoke bomb.",
        "My ancestors are clapping!",
        "Correct! I dropped my sword.",
        "WE'RE ALIVE! Correct!",
        "Nothing exploded! Correct!",
        "My eye stopped twitching.",
        "I fell out of the rafters!",
        "Okay okay okay. Correct.",
        "I didn't even scream!",
        "Correct?! Correct!",
        "Phew. The dojo still stands.",
        "My headband flew off!",
        "Somebody hold me. Correct.",
        "Right! I can breathe again.",
        "My heart can't take this.",
        "Correct. Nobody touch anything.",
      ],
    },
    correctWithHint: {
      plain: ["Hint. Correct. Breathe.", "With a hint! Still counts!"],
      flavor: [
        "The hint saved us both.",
        "Hint and done. I'm shaking.",
        "The hint actually worked!",
        "Thank the scroll of hints!",
        "Phew. Hints are friends.",
        "Saved by the hint. Again.",
      ],
    },
    goodGuess: {
      plain: ["Wait, you just knew?", "A guess?! And it's right?!"],
      flavor: [
        "How? Are you a ninja too?",
        "That guess was too right.",
        "Are you psychic? Be honest.",
        "That was spooky. Correct.",
        "Lucky guess? I'm terrified.",
        "Gah! How did you know?",
      ],
    },
    hookMiss: {
      plain: ["It's fine. It's totally fine.", "Wrong, but it's early. Fine."],
      flavor: [
        "Only a guess. Breathe.",
        "Nobody saw that. Moving on.",
        "I'll worry for both of us.",
        "It's a warm-up. Stay calm.",
        "Smoke bomb! We never saw it.",
        "Totally normal. I think.",
      ],
    },
    nudge: {
      plain: [
        "Not that one. Look again.",
        "Nope. Deep breath. Again.",
        "Not it. Don't panic.",
      ],
      flavor: [
        "Oh no. One more look?",
        "We can fix this. Probably.",
        "Eek. Try another?",
        "Wrong! Not doomed! Again!",
        "Don't look at me. Look again.",
        "My eye's twitching. Retry?",
        "I hid in a vase. Retry?",
        "Missed! Throw another star!",
        "Steady. Steady. Try again.",
        "My sword is shaking. Again!",
      ],
    },
    close: {
      plain: ["So close. Why always so close?", "Close! Not the best."],
      flavor: [
        "Nearly. That's almost worse.",
        "There's a better one, I swear.",
        "Close. My nerves can't take it.",
        "So close it hurts.",
        "Almost! I'm sweating.",
      ],
    },
    answer: {
      plain: ["Okay, don't panic. Here it is.", "Here it is. Stay calm."],
      flavor: [
        "Let's never speak of this.",
        "Quick, before it disappears!",
        "Here. Don't tell my sensei.",
        "Answer incoming. Brace!",
        "Phew. Here's how it works.",
      ],
    },
    streak: {
      plain: ["Three straight? Who ARE you?", "Three! Is this real?"],
      flavor: [
        "Stop, I can't handle a streak!",
        "Three! I need to sit down.",
        "Don't jinx it. DON'T.",
        "A streak?! I'm terrified.",
        "I'm writing a haiku about this.",
      ],
    },
    comeback: {
      plain: ["You came back. From THAT.", "Back from the brink!"],
      flavor: [
        "Never doubting you again.",
        "Phew. I thought that had us.",
        "From doom to done!",
        "The comeback! I'm sobbing.",
        "We're saved! You saved us!",
      ],
    },
    last: {
      plain: ["It's over. We made it.", "Last one. We survived."],
      flavor: [
        "I need to lie down.",
        "My knees gave out.",
        "We made it! Somehow!",
        "Done. I need a nap.",
        "Vanishing now. Smoke bomb!",
      ],
    },
  },
}
