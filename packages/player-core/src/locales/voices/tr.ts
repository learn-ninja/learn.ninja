import type { Voices } from "../../voices"

// Türkçe (sen). Casual kısa ve net, Sensei sakin bir usta, Unhinged ise çeviri gibi değil, insan gibi
// konuşan bir sinir küpü.

export const tr: Voices = {
  casual: {
    praise: {
      plain: ["Doğru.", "Aynen öyle."],
      flavor: [
        "Aferin!",
        "Kesinlikle.",
        "Buldun.",
        "Tam isabet.",
        "İyi gördün.",
        "İşte bu.",
        "O işte.",
        "Çok iyi.",
      ],
    },
    correctWithHint: {
      plain: ["Doğru, ipucuyla."],
      flavor: [
        "İpucu işini yaptı.",
        "Güzel çözdün.",
        "İpucuyla da olsa buldun.",
      ],
    },
    goodGuess: {
      plain: ["İyi tahmin!"],
      flavor: ["İyi sezgi.", "İyi karar.", "Keskin tahmin."],
    },
    hookMiss: {
      plain: ["Tam değil, sorun yok."],
      flavor: [
        "İyi deneme. Bakalım neden.",
        "Tam değil. Nedenini birazdan göreceksin.",
      ],
    },
    nudge: {
      plain: ["Tam değil. Bir daha bak."],
      flavor: [
        "Az kaldı. Bir daha dene.",
        "Bir bakış daha, tamamdır.",
        "Bir daha bak. Bence yakalarsın.",
      ],
    },
    close: {
      plain: ["Yakın, ama en iyisi değil."],
      flavor: [
        "Az kaldı. Başka bir seçenek daha iyi oturuyor.",
        "İyi, ama en iyisi değil.",
      ],
    },
    answer: {
      plain: ["İşte cevap."],
      flavor: [
        "İşte böyle çalışıyor.",
        "Bu zordu. İşte cevap.",
        "Cevaba bakalım.",
      ],
    },
    streak: {
      plain: ["Üst üste üç."],
      flavor: ["Seri yakaladın.", "Bu bir seri."],
    },
    comeback: {
      plain: ["İşte bu."],
      flavor: ["Bu sefer oldu.", "İyi toparladın."],
    },
    last: {
      plain: ["Sonuncusu da doğru."],
      flavor: ["Ders buydu.", "Güçlü bitirdin."],
    },
  },
  sensei: {
    praise: {
      plain: ["İyi.", "Evet."],
      flavor: [
        "İyi. Bir daha böyle.",
        "Gördün.",
        "Temiz.",
        "Böyle yapılır.",
        "İyi göz.",
        "Bunu sakla.",
        "Fazladan tek hareket yok.",
      ],
    },
    correctWithHint: {
      plain: ["İyi. İpucu yardım etti."],
      flavor: [
        "Sormak da çalışmaktır.",
        "İpucunu aldın, sonuna kadar götürdün.",
        "Önce yardım, sonra kendi ellerin.",
      ],
    },
    goodGuess: {
      plain: ["İyi tahmin."],
      flavor: [
        "Önce sezgi. Şimdi nedeni.",
        "Doğru tahmin. Bakalım neden.",
        "Ellerin kafandan önce bildi.",
      ],
    },
    hookMiss: {
      plain: ["Henüz değil. Buradan başlıyoruz."],
      flavor: [
        "Bir deneme başlangıç çizgisini gösterir.",
        "Önemli değil. İzle.",
      ],
    },
    nudge: {
      plain: ["Henüz değil. Bir daha."],
      flavor: ["Daha yavaş.", "Bir kez daha bak.", "Bir daha. Orada."],
    },
    close: {
      plain: ["Yakın. Daha iyisi var."],
      flavor: [
        "Neredeyse. Daha keskin olanı bul.",
        "İyi göz. Henüz en iyisi değil.",
      ],
    },
    answer: {
      plain: ["İşte cevap."],
      flavor: [
        "İzle, sonra kendin gör.",
        "Yavaş oku.",
        "Zor olanlar en çok öğretir. İşte.",
      ],
    },
    streak: {
      plain: ["Üst üste üç. Sağlam."],
      flavor: ["İyi ritim.", "Sakin eller."],
    },
    comeback: {
      plain: ["Bir daha baktın. İşte orada."],
      flavor: ["Çalışmak budur.", "İkinci bakış dersin kendisidir."],
    },
    last: {
      plain: ["Ders bu. Aferin."],
      flavor: ["Başladığını bitirdin.", "Son adım da sayılır."],
    },
  },
  unhinged: {
    praise: {
      plain: ["Doğru. Nefes al.", "Doğru. Kimse panik yapmasın."],
      flavor: [
        "Aa! Doğru. Gerçekten doğru!",
        "Oh be, başardın!",
        "Bunun işe yaradığına inanamıyorum.",
        "Of. Bittik sandım.",
        "Gözüm seğirmeyi bıraktı. Doğru.",
        "Başardın ve hiçbir şey patlamadı!",
        "Doğru. Kalbim buna dayanmıyor.",
      ],
    },
    correctWithHint: {
      plain: ["İpucu. Doğru. Nefes al."],
      flavor: [
        "İpucu ikimizi de kurtardı.",
        "Of, ipucu ve bitti. Titriyorum.",
        "İpucu işe yaradı. Gerçekten yaradı!",
      ],
    },
    goodGuess: {
      plain: ["Dur, öylece biliyor muydun?"],
      flavor: [
        "Aa! Nereden bildin?",
        "O tahmin fazla doğruydu.",
        "Nasıl? Beni mi izliyorsun?",
      ],
    },
    hookMiss: {
      plain: ["Sorun yok. Gerçekten sorun yok."],
      flavor: [
        "Yanlış, ama sadece tahmindi. Nefes al.",
        "Kimse görmedi. Devam.",
        "Merak etme, senin yerine ben ederim.",
      ],
    },
    nudge: {
      plain: ["O değil. Bir daha bak."],
      flavor: [
        "Olamaz, olamaz. Bir bakış daha?",
        "Tamam, derin nefes. Bir daha bak.",
        "O değil, ama hâlâ düzeltebilirsin.",
      ],
    },
    close: {
      plain: ["Çok yakın. Neden hep bu kadar yakın?"],
      flavor: [
        "Az kaldı. Bu neredeyse daha kötü.",
        "Daha iyisi var, yemin ederim.",
        "Yakın. Sinirlerim yakına dayanmıyor.",
      ],
    },
    answer: {
      plain: ["Tamam, panik yok. İşte cevap."],
      flavor: [
        "İşte cevap. Bundan bir daha hiç bahsetmeyelim.",
        "Çabuk, kaybolmadan!",
        "Of. Tamam. İşte böyle çalışıyor.",
      ],
    },
    streak: {
      plain: ["Üst üste üç mü? Sen KİMSİN?"],
      flavor: ["Dur, dur, seriye dayanamıyorum!", "Üç! Oturmam lazım."],
    },
    comeback: {
      plain: ["Geri döndün. ONDAN sonra."],
      flavor: [
        "Düzeldi. Bir daha senden asla şüphe etmem. Bir dahakine kadar.",
        "Of. O bizi bitirdi sandım.",
      ],
    },
    last: {
      plain: ["Bitti. Başardık."],
      flavor: ["Uzanmam lazım.", "Sonuncu. Dizlerim çözüldü."],
    },
  },
}
