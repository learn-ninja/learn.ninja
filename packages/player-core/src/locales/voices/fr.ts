import type { Voices } from "../../voices"

// Français courant (tu). Casual est bref et clair, Sensei est un maître posé, et Unhinged est une
// boule de nerfs qui parle comme on parle, pas comme on traduit.

export const fr: Voices = {
  casual: {
    praise: {
      plain: ["Correct.", "C'est ça."],
      flavor: [
        "Bien joué !",
        "Exactement.",
        "Tu l'as.",
        "En plein dans le mille.",
        "Bien vu.",
        "Voilà.",
        "C'est celle-là.",
        "Très bien.",
      ],
    },
    correctWithHint: {
      plain: ["Correct, avec un indice."],
      flavor: [
        "L'indice a fait son travail.",
        "Bien raisonné.",
        "Avec un indice, mais tu y es.",
      ],
    },
    goodGuess: {
      plain: ["Bien deviné !"],
      flavor: ["Bon instinct.", "Bon choix.", "Belle intuition."],
    },
    hookMiss: {
      plain: ["Pas tout à fait, et ce n'est pas grave."],
      flavor: [
        "Bel essai. Voyons pourquoi.",
        "Pas tout à fait. Tu verras vite pourquoi.",
      ],
    },
    nudge: {
      plain: ["Pas tout à fait. Regarde encore."],
      flavor: [
        "Presque. Réessaie.",
        "Encore un coup d'œil et c'est bon.",
        "Regarde encore une fois. Je pense que tu peux le trouver.",
      ],
    },
    close: {
      plain: ["Proche, mais pas la meilleure."],
      flavor: [
        "Presque. Une autre option convient mieux.",
        "Bien, mais pas la meilleure.",
      ],
    },
    answer: {
      plain: ["Voici la réponse."],
      flavor: [
        "Voici comment ça marche.",
        "Celle-là était difficile. La voici.",
        "Regardons la réponse.",
      ],
    },
    streak: {
      plain: ["Trois d'affilée."],
      flavor: ["Tu es lancé.", "Ça, c'est une série."],
    },
    comeback: {
      plain: ["Et voilà."],
      flavor: ["Cette fois, c'est la bonne.", "Belle remontée."],
    },
    last: {
      plain: ["La dernière, et elle est juste."],
      flavor: ["C'était ça, la leçon.", "Tu finis fort."],
    },
  },
  sensei: {
    praise: {
      plain: ["Bien.", "Oui."],
      flavor: [
        "Bien. Encore comme ça.",
        "Tu l'as vu.",
        "Net.",
        "C'est la manière.",
        "Bon œil.",
        "Garde ça.",
        "Pas un geste de trop.",
      ],
    },
    correctWithHint: {
      plain: ["Bien. L'indice a aidé."],
      flavor: [
        "Demander, c'est aussi s'exercer.",
        "Tu as pris l'indice et tu as fini.",
        "L'aide d'abord, tes mains ensuite.",
      ],
    },
    goodGuess: {
      plain: ["Bonne intuition."],
      flavor: [
        "L'instinct d'abord. La raison maintenant.",
        "Bien deviné. Voyons pourquoi.",
        "Tes mains savaient avant ta tête.",
      ],
    },
    hookMiss: {
      plain: ["Pas encore. On commence ici."],
      flavor: ["Un essai montre la ligne de départ.", "Peu importe. Regarde."],
    },
    nudge: {
      plain: ["Pas encore. Encore une fois."],
      flavor: ["Plus lentement.", "Regarde encore.", "Encore. C'est là."],
    },
    close: {
      plain: ["Proche. Il y a mieux."],
      flavor: [
        "Presque. Cherche la plus juste.",
        "Bon œil. Pas encore la meilleure.",
      ],
    },
    answer: {
      plain: ["Voici la réponse."],
      flavor: [
        "Regarde, puis vois-le par toi-même.",
        "Lis-la lentement.",
        "Les difficiles apprennent le plus. Voici.",
      ],
    },
    streak: {
      plain: ["Trois de suite. Stable."],
      flavor: ["Bon rythme.", "Mains calmes."],
    },
    comeback: {
      plain: ["Tu as regardé encore. La voilà."],
      flavor: ["C'est ça, s'exercer.", "Le second regard est la leçon."],
    },
    last: {
      plain: ["C'est la leçon. Bien joué."],
      flavor: [
        "Tu as fini ce que tu as commencé.",
        "Le dernier pas compte aussi.",
      ],
    },
  },
  unhinged: {
    praise: {
      plain: ["Correct. Respire.", "C'est juste. Que personne ne panique."],
      flavor: [
        "Aaah ! C'est juste. C'est vraiment juste !",
        "Oh là là, tu l'as fait !",
        "J'arrive pas à croire que ça a marché.",
        "Ouf. J'ai cru qu'on était fichus.",
        "Mon œil a arrêté de trembler. Correct.",
        "Tu l'as fait et rien n'a explosé !",
        "Correct. Mon cœur ne tiendra pas.",
      ],
    },
    correctWithHint: {
      plain: ["Indice. Correct. Respire."],
      flavor: [
        "L'indice nous a sauvés tous les deux.",
        "Ouf, indice et c'est fait. Je tremble.",
        "L'indice a marché. Il a vraiment marché !",
      ],
    },
    goodGuess: {
      plain: ["Attends, tu le savais, comme ça ?"],
      flavor: [
        "Aaah ! Comment tu savais ?",
        "Cette intuition était trop juste.",
        "Comment ? Tu m'espionnes ?",
      ],
    },
    hookMiss: {
      plain: ["C'est rien. Vraiment, c'est rien."],
      flavor: [
        "Faux, mais c'était juste une supposition. Respire.",
        "Personne n'a rien vu. On avance.",
        "T'inquiète, je m'inquiète pour toi.",
      ],
    },
    nudge: {
      plain: ["Pas celle-là. Regarde encore."],
      flavor: [
        "Oh non, oh non. Encore un coup d'œil ?",
        "Bon, grande inspiration. Regarde encore.",
        "C'est pas ça, mais tu peux encore rattraper.",
      ],
    },
    close: {
      plain: ["Si proche. Pourquoi c'est toujours si proche ?"],
      flavor: [
        "Presque. C'est presque pire.",
        "Il y en a une meilleure, je te jure.",
        "Proche. Mes nerfs ne supportent pas proche.",
      ],
    },
    answer: {
      plain: ["Bon, pas de panique. La voici."],
      flavor: [
        "La voici. N'en parlons plus jamais.",
        "Vite, avant qu'elle disparaisse !",
        "Ouf. Bon. Voici comment ça marche.",
      ],
    },
    streak: {
      plain: ["Trois d'affilée ? Mais t'es QUI ?"],
      flavor: [
        "Stop, stop, je ne supporte pas les séries !",
        "Trois ! Il faut que je m'assoie.",
      ],
    },
    comeback: {
      plain: ["T'es revenu. De ÇA."],
      flavor: [
        "Réparé. Je ne doute plus jamais de toi. Jusqu'à la prochaine.",
        "Ouf. J'ai cru que celle-là nous avait eus.",
      ],
    },
    last: {
      plain: ["C'est fini. On a réussi."],
      flavor: [
        "Il faut que je m'allonge.",
        "La dernière. Mes genoux ont lâché.",
      ],
    },
  },
}
