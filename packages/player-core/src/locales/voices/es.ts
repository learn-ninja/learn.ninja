import type { Voices } from "../../voices"

// Español neutro (tú). Casual es breve y claro, Sensei es un maestro sereno, y Unhinged es un manojo
// de nervios que habla como se habla, no como se traduce.

export const es: Voices = {
  casual: {
    praise: {
      plain: ["Correcto.", "Así es."],
      flavor: [
        "¡Buen trabajo!",
        "Exacto.",
        "Lo tienes.",
        "Perfecto.",
        "Bien visto.",
        "Eso es.",
        "Esa es.",
        "Muy bien.",
      ],
    },
    correctWithHint: {
      plain: ["Correcto, con una pista."],
      flavor: [
        "La pista hizo su trabajo.",
        "Bien resuelto.",
        "Con pista, pero lo lograste.",
      ],
    },
    goodGuess: {
      plain: ["¡Buena intuición!"],
      flavor: ["Buen instinto.", "Buen ojo.", "Bien pensado."],
    },
    hookMiss: {
      plain: ["No del todo, y no pasa nada."],
      flavor: [
        "Buen intento. Veamos por qué.",
        "No del todo. Pronto verás por qué.",
      ],
    },
    nudge: {
      plain: ["No del todo. Míralo otra vez."],
      flavor: [
        "Casi. Inténtalo de nuevo.",
        "Un vistazo más y lo tienes.",
        "Míralo otra vez. Seguro que lo encuentras.",
      ],
    },
    close: {
      plain: ["Cerca, pero no es la mejor."],
      flavor: ["Casi. Otra opción encaja mejor.", "Bien, pero no es la mejor."],
    },
    answer: {
      plain: ["Esta es la respuesta."],
      flavor: [
        "Así es como funciona.",
        "Esta era difícil. Aquí está.",
        "Veamos la respuesta.",
      ],
    },
    streak: {
      plain: ["Tres seguidas."],
      flavor: ["Vas en racha.", "Eso es una racha."],
    },
    comeback: {
      plain: ["Ahí está."],
      flavor: ["Esta vez sí.", "Buena recuperación."],
    },
    last: {
      plain: ["La última, y correcta."],
      flavor: ["Esa era la lección.", "Terminaste fuerte."],
    },
  },
  sensei: {
    praise: {
      plain: ["Bien.", "Sí."],
      flavor: [
        "Bien. Otra vez así.",
        "Lo viste.",
        "Limpio.",
        "Así se hace.",
        "Buen ojo.",
        "Guarda eso.",
        "Sin un movimiento de más.",
      ],
    },
    correctWithHint: {
      plain: ["Bien. La pista ayudó."],
      flavor: [
        "Preguntar también es practicar.",
        "Tomaste la pista y lo terminaste.",
        "Primero la ayuda, luego tus manos.",
      ],
    },
    goodGuess: {
      plain: ["Buena intuición."],
      flavor: [
        "Primero el instinto. Ahora la razón.",
        "Bien adivinado. Veamos por qué.",
        "Tus manos lo supieron antes que tu cabeza.",
      ],
    },
    hookMiss: {
      plain: ["Todavía no. Empezamos aquí."],
      flavor: ["Un intento marca la salida.", "No importa. Mira."],
    },
    nudge: {
      plain: ["Todavía no. Otra vez."],
      flavor: ["Más despacio.", "Mira una vez más.", "Otra vez. Ahí está."],
    },
    close: {
      plain: ["Cerca. Hay una mejor."],
      flavor: ["Casi. Busca la más precisa.", "Buen ojo. Aún no es la mejor."],
    },
    answer: {
      plain: ["Aquí está la respuesta."],
      flavor: [
        "Mira, y luego velo por ti mismo.",
        "Léela despacio.",
        "Las difíciles enseñan más. Aquí.",
      ],
    },
    streak: {
      plain: ["Tres seguidas. Firme."],
      flavor: ["Buen ritmo.", "Manos tranquilas."],
    },
    comeback: {
      plain: ["Volviste a mirar. Ahí está."],
      flavor: ["Eso es practicar.", "La segunda mirada es la lección."],
    },
    last: {
      plain: ["Esa es la lección. Bien hecho."],
      flavor: [
        "Terminaste lo que empezaste.",
        "El último paso también cuenta.",
      ],
    },
  },
  unhinged: {
    praise: {
      plain: ["Correcto. Respira.", "Está bien. Que nadie entre en pánico."],
      flavor: [
        "¡Ay! Está bien. ¡Está bien de verdad!",
        "¡Madre mía, lo lograste!",
        "No me creo que haya funcionado.",
        "Uf. Pensé que estábamos perdidos.",
        "Se me pasó el tic del ojo. Correcto.",
        "¡Lo lograste y nada explotó!",
        "Correcto. Mi corazón no aguanta esto.",
      ],
    },
    correctWithHint: {
      plain: ["Pista. Correcto. Respira."],
      flavor: [
        "La pista nos salvó a los dos.",
        "Uf, pista y listo. Estoy temblando.",
        "La pista funcionó. ¡Funcionó de verdad!",
      ],
    },
    goodGuess: {
      plain: ["Espera, ¿lo sabías sin más?"],
      flavor: [
        "¡Ay! ¿Cómo lo supiste?",
        "Esa intuición fue demasiado buena.",
        "¿Cómo? ¿Me estás espiando?",
      ],
    },
    hookMiss: {
      plain: ["No pasa nada. De verdad que no pasa nada."],
      flavor: [
        "Mal, pero era solo una suposición. Respira.",
        "Nadie lo vio. Seguimos.",
        "Tranquilo, yo me preocupo por ti.",
      ],
    },
    nudge: {
      plain: ["Esa no. Mira otra vez."],
      flavor: [
        "Ay, no, ay, no. ¿Una mirada más?",
        "Bueno, respira hondo. Mira otra vez.",
        "No es esa, pero todavía lo puedes arreglar.",
      ],
    },
    close: {
      plain: ["Tan cerca. ¿Por qué siempre tan cerca?"],
      flavor: [
        "Casi. Eso es casi peor.",
        "Hay una mejor, te lo juro.",
        "Cerca. Mis nervios no soportan lo cerca.",
      ],
    },
    answer: {
      plain: ["Bueno, sin pánico. Aquí está."],
      flavor: [
        "Aquí está. No volvamos a hablar de esto.",
        "¡Rápido, antes de que desaparezca!",
        "Uf. Bueno. Así es como funciona.",
      ],
    },
    streak: {
      plain: ["¿Tres seguidas? ¿Quién ERES?"],
      flavor: [
        "¡Para, para, no aguanto una racha!",
        "¡Tres! Necesito sentarme.",
      ],
    },
    comeback: {
      plain: ["Volviste. De ESO."],
      flavor: [
        "Arreglado. Nunca más dudo de ti. Hasta la próxima.",
        "Uf. Pensé que esa nos había ganado.",
      ],
    },
    last: {
      plain: ["Se acabó. Lo logramos."],
      flavor: ["Necesito acostarme.", "La última. Me fallaron las rodillas."],
    },
  },
}
