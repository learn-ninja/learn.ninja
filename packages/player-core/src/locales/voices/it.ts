import type { Voices } from "../../voices"

// Italiano (tu). Casual è breve e chiaro, Sensei è un maestro pacato, e Unhinged è un fascio di nervi
// che parla come si parla, non come si traduce.

export const it: Voices = {
  casual: {
    praise: {
      plain: ["Corretto.", "Proprio così."],
      flavor: [
        "Ottimo lavoro!",
        "Esatto.",
        "Ci sei.",
        "Centro.",
        "Ben visto.",
        "Ecco.",
        "È quella.",
        "Molto bene.",
      ],
    },
    correctWithHint: {
      plain: ["Corretto, con un suggerimento."],
      flavor: [
        "Il suggerimento ha fatto il suo.",
        "Ben ragionato.",
        "Con un aiuto, ma ci sei arrivato.",
      ],
    },
    goodGuess: {
      plain: ["Bella intuizione!"],
      flavor: ["Buon istinto.", "Buona scelta.", "Intuizione precisa."],
    },
    hookMiss: {
      plain: ["Non proprio, e va bene così."],
      flavor: [
        "Buon tentativo. Vediamo perché.",
        "Non proprio. Vedrai presto perché.",
      ],
    },
    nudge: {
      plain: ["Non proprio. Guarda di nuovo."],
      flavor: [
        "Quasi. Riprova.",
        "Ancora un'occhiata e ci sei.",
        "Dagli un'altra occhiata. Credo che tu possa trovarlo.",
      ],
    },
    close: {
      plain: ["Vicino, ma non la migliore."],
      flavor: [
        "Quasi. Un'altra opzione calza meglio.",
        "Buona, ma non la migliore.",
      ],
    },
    answer: {
      plain: ["Ecco la risposta."],
      flavor: [
        "Ecco come funziona.",
        "Questa era difficile. Eccola.",
        "Guardiamo la risposta.",
      ],
    },
    streak: {
      plain: ["Tre di fila."],
      flavor: ["Sei in serie.", "Questa è una striscia."],
    },
    comeback: {
      plain: ["Eccola."],
      flavor: ["Stavolta sì.", "Bel recupero."],
    },
    last: {
      plain: ["L'ultima, ed è giusta."],
      flavor: ["Questa era la lezione.", "Hai chiuso alla grande."],
    },
  },
  sensei: {
    praise: {
      plain: ["Bene.", "Sì."],
      flavor: [
        "Bene. Ancora così.",
        "L'hai visto.",
        "Pulito.",
        "È così che si fa.",
        "Buon occhio.",
        "Tienilo.",
        "Nessun movimento di troppo.",
      ],
    },
    correctWithHint: {
      plain: ["Bene. L'aiuto è servito."],
      flavor: [
        "Chiedere è anche pratica.",
        "Hai preso l'aiuto e hai finito.",
        "Prima l'aiuto, poi le tue mani.",
      ],
    },
    goodGuess: {
      plain: ["Buon intuito."],
      flavor: [
        "Prima l'istinto. Ora il motivo.",
        "Ben indovinato. Vediamo perché.",
        "Le tue mani lo sapevano prima della testa.",
      ],
    },
    hookMiss: {
      plain: ["Non ancora. Si parte da qui."],
      flavor: [
        "Un tentativo mostra la linea di partenza.",
        "Non importa. Guarda.",
      ],
    },
    nudge: {
      plain: ["Non ancora. Di nuovo."],
      flavor: ["Più piano.", "Guarda ancora una volta.", "Di nuovo. È lì."],
    },
    close: {
      plain: ["Vicino. Ce n'è una migliore."],
      flavor: [
        "Quasi. Cerca quella più precisa.",
        "Buon occhio. Non ancora la migliore.",
      ],
    },
    answer: {
      plain: ["Ecco la risposta."],
      flavor: [
        "Guarda, poi vedilo da solo.",
        "Leggila piano.",
        "Le difficili insegnano di più. Ecco.",
      ],
    },
    streak: {
      plain: ["Tre di fila. Saldo."],
      flavor: ["Buon ritmo.", "Mani calme."],
    },
    comeback: {
      plain: ["Hai guardato di nuovo. Eccola."],
      flavor: ["Questa è pratica.", "Il secondo sguardo è la lezione."],
    },
    last: {
      plain: ["Questa è la lezione. Ben fatto."],
      flavor: [
        "Hai finito ciò che hai iniziato.",
        "Anche l'ultimo passo conta.",
      ],
    },
  },
  unhinged: {
    praise: {
      plain: ["Corretto. Respira.", "È giusta. Nessuno si agiti."],
      flavor: [
        "Ahh! È giusta. È giusta davvero!",
        "Mamma mia, ce l'hai fatta!",
        "Non ci credo che ha funzionato.",
        "Uff. Pensavo fossimo spacciati.",
        "L'occhio ha smesso di tremare. Corretto.",
        "Ce l'hai fatta e non è esploso niente!",
        "Corretto. Il mio cuore non regge.",
      ],
    },
    correctWithHint: {
      plain: ["Suggerimento. Corretto. Respira."],
      flavor: [
        "Il suggerimento ci ha salvati entrambi.",
        "Uff, suggerimento e via. Sto tremando.",
        "Il suggerimento ha funzionato. Ha funzionato davvero!",
      ],
    },
    goodGuess: {
      plain: ["Aspetta, lo sapevi e basta?"],
      flavor: [
        "Ahh! Come facevi a saperlo?",
        "Quell'intuizione era troppo giusta.",
        "Come? Mi stai spiando?",
      ],
    },
    hookMiss: {
      plain: ["Va bene. Va benissimo, davvero."],
      flavor: [
        "Sbagliato, ma era solo un'ipotesi. Respira.",
        "Nessuno ha visto. Andiamo avanti.",
        "Tranquillo, mi preoccupo io per te.",
      ],
    },
    nudge: {
      plain: ["Non quella. Guarda di nuovo."],
      flavor: [
        "Oh no, oh no. Un'altra occhiata?",
        "Ok, respiro profondo. Guarda di nuovo.",
        "Non è quella, ma puoi ancora rimediare.",
      ],
    },
    close: {
      plain: ["Così vicino. Perché è sempre così vicino?"],
      flavor: [
        "Quasi. È quasi peggio.",
        "Ce n'è una migliore, lo giuro.",
        "Vicino. I miei nervi non reggono il vicino.",
      ],
    },
    answer: {
      plain: ["Ok, niente panico. Eccola."],
      flavor: [
        "Eccola. Non parliamone mai più.",
        "Presto, prima che sparisca!",
        "Uff. Ok. Ecco come funziona.",
      ],
    },
    streak: {
      plain: ["Tre di fila? Ma chi SEI?"],
      flavor: ["Basta, basta, non reggo una serie!", "Tre! Devo sedermi."],
    },
    comeback: {
      plain: ["Sei tornato. Da QUELLO."],
      flavor: [
        "Sistemato. Non dubiterò mai più di te. Fino alla prossima.",
        "Uff. Pensavo che quella ci avesse fregati.",
      ],
    },
    last: {
      plain: ["È finita. Ce l'abbiamo fatta."],
      flavor: ["Devo sdraiarmi.", "L'ultima. Le ginocchia hanno ceduto."],
    },
  },
}
