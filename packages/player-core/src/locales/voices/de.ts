import type { Voices } from "../../voices"

// Deutsch (du). Casual ist kurz und klar, Sensei ein ruhiger Lehrmeister, und Unhinged ein
// Nervenbündel, das redet, wie man redet, nicht wie man übersetzt.

export const de: Voices = {
  casual: {
    praise: {
      plain: ["Richtig.", "Genau so."],
      flavor: [
        "Gut gemacht!",
        "Genau.",
        "Du hast es.",
        "Volltreffer.",
        "Gut erkannt.",
        "Na bitte.",
        "Das ist es.",
        "Sehr gut.",
      ],
    },
    correctWithHint: {
      plain: ["Richtig, mit einem Tipp."],
      flavor: [
        "Der Tipp hat seinen Zweck erfüllt.",
        "Sauber gelöst.",
        "Mit Tipp, aber geschafft.",
      ],
    },
    goodGuess: {
      plain: ["Gut geraten!"],
      flavor: ["Guter Instinkt.", "Gute Wahl.", "Treffsicher geraten."],
    },
    hookMiss: {
      plain: ["Nicht ganz, und das ist okay."],
      flavor: [
        "Guter Versuch. Schauen wir, warum.",
        "Nicht ganz. Du siehst gleich, warum.",
      ],
    },
    nudge: {
      plain: ["Nicht ganz. Schau noch einmal hin."],
      flavor: [
        "Fast. Versuch es noch einmal.",
        "Noch ein Blick, dann hast du es.",
        "Schau noch einmal hin. Ich glaube, du findest es.",
      ],
    },
    close: {
      plain: ["Nah dran, aber nicht die beste."],
      flavor: [
        "Fast. Eine andere Option passt besser.",
        "Gut, aber nicht die beste.",
      ],
    },
    answer: {
      plain: ["Hier ist die Antwort."],
      flavor: [
        "So funktioniert es.",
        "Die war knifflig. Hier ist sie.",
        "Schauen wir uns die Antwort an.",
      ],
    },
    streak: {
      plain: ["Drei in Folge."],
      flavor: ["Du bist im Flow.", "Das ist eine Serie."],
    },
    comeback: {
      plain: ["Da ist es."],
      flavor: ["Diesmal sitzt es.", "Gut aufgeholt."],
    },
    last: {
      plain: ["Die letzte, und sie stimmt."],
      flavor: ["Das war die Lektion.", "Stark zu Ende gebracht."],
    },
  },
  sensei: {
    praise: {
      plain: ["Gut.", "Ja."],
      flavor: [
        "Gut. Noch einmal so.",
        "Du hast es gesehen.",
        "Sauber.",
        "So geht das.",
        "Gutes Auge.",
        "Behalte das.",
        "Keine Bewegung zu viel.",
      ],
    },
    correctWithHint: {
      plain: ["Gut. Der Hinweis hat geholfen."],
      flavor: [
        "Fragen ist auch Übung.",
        "Du hast den Hinweis genommen und es zu Ende gebracht.",
        "Erst die Hilfe, dann deine eigenen Hände.",
      ],
    },
    goodGuess: {
      plain: ["Gut geraten."],
      flavor: [
        "Erst das Gefühl. Jetzt der Grund.",
        "Richtig geraten. Sehen wir, warum.",
        "Deine Hände wussten es vor deinem Kopf.",
      ],
    },
    hookMiss: {
      plain: ["Noch nicht. Hier fangen wir an."],
      flavor: ["Ein Versuch zeigt die Startlinie.", "Macht nichts. Schau zu."],
    },
    nudge: {
      plain: ["Noch nicht. Noch einmal."],
      flavor: [
        "Langsamer.",
        "Schau noch einmal hin.",
        "Noch einmal. Es ist da.",
      ],
    },
    close: {
      plain: ["Nah dran. Eine ist besser."],
      flavor: [
        "Fast. Such die schärfere.",
        "Gutes Auge. Noch nicht die beste.",
      ],
    },
    answer: {
      plain: ["Hier ist die Antwort."],
      flavor: [
        "Schau zu, dann sieh es selbst.",
        "Lies sie langsam.",
        "Die schweren lehren am meisten. Hier.",
      ],
    },
    streak: {
      plain: ["Drei in Folge. Ruhig."],
      flavor: ["Guter Rhythmus.", "Ruhige Hände."],
    },
    comeback: {
      plain: ["Du hast noch einmal hingeschaut. Da ist es."],
      flavor: ["Das ist Übung.", "Der zweite Blick ist die Lektion."],
    },
    last: {
      plain: ["Das war die Lektion. Gut gemacht."],
      flavor: [
        "Du hast beendet, was du begonnen hast.",
        "Der letzte Schritt zählt auch.",
      ],
    },
  },
  unhinged: {
    praise: {
      plain: ["Richtig. Durchatmen.", "Es stimmt. Keine Panik."],
      flavor: [
        "Ah! Es stimmt. Es stimmt wirklich!",
        "Oh Mann, oh Mann, du hast es geschafft!",
        "Ich fass es nicht, dass das geklappt hat.",
        "Puh. Ich dachte, wir sind erledigt.",
        "Mein Auge hat aufgehört zu zucken. Richtig.",
        "Geschafft, und nichts ist explodiert!",
        "Richtig. Mein Herz hält das nicht aus.",
      ],
    },
    correctWithHint: {
      plain: ["Tipp. Richtig. Durchatmen."],
      flavor: [
        "Der Tipp hat uns beide gerettet.",
        "Puh, Tipp und fertig. Ich zittere.",
        "Der Tipp hat funktioniert. Er hat wirklich funktioniert!",
      ],
    },
    goodGuess: {
      plain: ["Moment, du wusstest das einfach?"],
      flavor: [
        "Ah! Woher wusstest du das?",
        "Das war zu gut geraten.",
        "Wie? Beobachtest du mich?",
      ],
    },
    hookMiss: {
      plain: ["Alles gut. Wirklich, alles gut."],
      flavor: [
        "Falsch, aber nur geraten. Durchatmen.",
        "Hat keiner gesehen. Weiter.",
        "Keine Sorge, ich sorge mich für dich.",
      ],
    },
    nudge: {
      plain: ["Die nicht. Schau noch mal."],
      flavor: [
        "Oh nein, oh nein. Noch ein Blick?",
        "Okay, tief durchatmen. Schau noch mal.",
        "Nicht die, aber du kannst es noch retten.",
      ],
    },
    close: {
      plain: ["So knapp. Warum immer so knapp?"],
      flavor: [
        "Fast. Das ist fast schlimmer.",
        "Es gibt eine bessere, ich schwöre.",
        "Knapp. Meine Nerven halten knapp nicht aus.",
      ],
    },
    answer: {
      plain: ["Okay, keine Panik. Hier ist sie."],
      flavor: [
        "Hier ist sie. Reden wir nie wieder darüber.",
        "Schnell, bevor sie verschwindet!",
        "Puh. Okay. So funktioniert es.",
      ],
    },
    streak: {
      plain: ["Drei in Folge? Wer BIST du?"],
      flavor: [
        "Stopp, stopp, ich halte keine Serie aus!",
        "Drei! Ich muss mich setzen.",
      ],
    },
    comeback: {
      plain: ["Du bist zurück. Nach DEM."],
      flavor: [
        "Gerettet. Ich zweifle nie wieder an dir. Bis zum nächsten Mal.",
        "Puh. Ich dachte, die hätte uns erwischt.",
      ],
    },
    last: {
      plain: ["Vorbei. Wir haben es geschafft."],
      flavor: ["Ich muss mich hinlegen.", "Die letzte. Meine Knie sind weich."],
    },
  },
}
