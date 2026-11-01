# Kart dərsi: necə işləyir

Bu sənəd "Şəxs kartları" dərsinin hazırkı işləmə qaydasını təsvir edir. Burada heç nə dəyişdirilməyib.
Oxu, sonra nəyi necə dəyişmək istədiyini de.

---

## 1. Kim nə edir (3 hissə)

| Hissə | Nə edir | Səhv edə bilərmi? |
|---|---|---|
| **Müəllim (Gemini səs modeli)** | Səsini **birbaşa eşidir**, danışır, səhvi izah edir, ✓ qoymağı və səhvi yazmağı tətbiqdən **xahiş edir** (funksiya çağırışı ilə) | Bəli: bəzən güzəştə gedir, bəzən çaşır |
| **Yazıya çevirmə (Google ASR)** | Sənin səsini çatda yazıya çevirir | Bəli: **səhv sonluqları özü düzəldir** ("kommet" → "komme") |
| **Tətbiq (mənim kodum)** | Kartları, ✓-ləri, kart nömrəsini idarə edir, yazını yoxlayır, səhvləri dəftərə yazır, müəllimə əmr göndərir | Qaydalar sabitdir, amma **yalnız yazını görür, səsi görmür** |

> Əsas məhdudiyyət: sözün sonunu (kommet/komme) yalnız **müəllim** səsdən eşidə bilər.
> Tətbiq isə yalnız yazı görür və yazı artıq düzəldilmiş gəlir.

---

## 2. Zaman axını (addım-addım)

### A) Başlanğıc
1. **▶️ Başla** basılır → mikrofon açılır, Gemini-yə qoşulur.
2. Tətbiq müəllimə **sistem təlimatını** (aşağıda 4-cü bölmə) və 3 funksiyanı göndərir: `log_mistake`, `mark_correct`, `show_card`.
3. Model ardıcıllığı: əvvəlcə `gemini-3.8-live`. Əlçatan deyilsə: `09-2025` → `3.1-flash-live` → `12-2025`. İşləyən model yadda qalır.
4. Qoşulandan sonra tətbiq müəllimə yazır: `Hallo! Bitte beginne jetzt die Lektion.`
5. Müəllim qaydanı **bir dəfə** azərbaycanca izah edir.
6. Ekranda 1-ci kartın **Name** sətri sarı işıqlanır: 🎤 *Ich heiße …*

### B) Sən danışırsan ("Bas və danış")
1. Düyməni basırsan → yeni cümlə başlayır, səs Gemini-yə gedir.
2. Düyməni buraxırsan → səs daha **0.45 san** davam edir, sonra **0.8 san sükut** + "səs bitdi" siqnalı göndərilir.
3. Eyni vaxtda:
   - ASR sənin sözünü yazıya çevirir və çatda göstərir. Mənasızdırsa ("40356", gürcü hərfləri), *"səsin yazıya çevrilmədi"* yazılır.
   - Müəllim səsini eşidib qərar verir.

### C) Müəllim cümləni DÜZGÜN hesab edirsə
1. Müəllim `mark_correct(card, field, heard, pronunciation)` çağırır.
   - `heard` = müəllimin **hərfi eşitdiyi** cümlə (düzəltməməlidir)
   - `pronunciation` = "good" və ya "wrong"
2. Tətbiq **0.9 san gözləyir** (ASR yazısı gec gəlir), sonra ardıcıl yoxlayır:

| # | Yoxlama | Nəticə alınmasa |
|---|---|---|
| 1 | Kart artıq bitib? | "Kart bitib, növbəti kart budur" |
| 2 | `pronunciation = wrong`? | ✓ yox. Müəllimə: "səhvi yaz, izah et, təkrar etdir" |
| 3 | **ASR yazısında** qrammatika qaydası səhv tapır? (ich heiß, wohne aus, aus Türkei…) | ✓ yox. Səhv dəftərə, müəllimə izah mətni |
| 4 | **Müəllimin `heard` mətni** qaydaya uyğundur və kartdakı cümlə ilə **tam eynidir**? | ✓ yox. "kommet" → *"'ich' ilə fel -e ilə bitir: komme"* |
| 5 | **ASR yazısı** kartdakı cümlə ilə tam eynidir? | ✓ yox. Sözbəsöz fərq: *"wone" yox, "wohne"* |
| ✔ | Hamısı keçdi | ✓ qoyulur, çatda **✅ Ich komme aus Deutschland.**, müəllimə: "yalnız 'Super!' de" + növbəti addım |

3. Bir cümlə **3 dəfə** alınmasa → sarı **!** qoyulur, dərs davam edir (ilişib qalmır).

### D) Müəllim cümləni SƏHV hesab edirsə
1. Müəllim `log_mistake(wrong, correct, explanation)` çağırır, sonra izah edir.
2. Tətbiq:
   - ❌ hissəsinə ASR yazısını yazır (mənalıdırsa), yoxsa müəllimin yazdığını.
   - **İstisna:** müəllim eyni cümləyə 2-ci dəfə "səhv" deyirsə, amma ASR yazısı kartdakı cümlə ilə tam eynidirsə → tətbiq qəbul edir və ✓ qoyur ("yağı/Jahre" ilişməsinə qarşı).
   - Səhv sayğacı artır, 3-cü dəfədə keçilir.

### E) Müəllimin cavabı bitəndə (turnComplete)
1. ✓ yoxlaması hələ gedirsə, gözləyir (düzəliş iki dəfə getməsin).
2. ASR yazısında qrammatika və ya söz səhvi var, amma müəllim heç nə deməyibsə → tətbiq özü səhvi yazır və müəllimə göndərir: *"[App] Grammar check: … indi səsli düzəlt"*.
3. ASR yazısı kartdakı cümlə ilə tam eynidirsə, amma müəllim ✓ qoymağı unudubsa → tətbiq özü ✓ qoyur.

### F) Kart bitəndə
1. 5 ✓ → kart yaşıl, ulduz, konfeti.
2. Müəllimə dəqiq cümlə gedir: *"Super! İndi 5-ci kart: Ali."* (kart nömrəsini **tətbiq** seçir).
3. Model `show_card` ilə başqa kart desə, tətbiq bunu nəzərə almır.

### G) Cavab gəlmirsə
- 4 san → yenə 1.2 san sükut göndərilir.
- 8 san → müəllimə: *"[App] The learner has finished speaking. Respond now…"*

### H) Bağlantı qopanda (1011)
1. Eyni modelə "söhbət açarı" ilə qayıdır (yaddaş qalır).
2. 2-ci qopmada növbəti modelə keçir. Yaddaş itir, ona görə tətbiq dəqiq vəziyyəti göndərir: *"Kart 1 (Thomas). Düzgün: name, age. Qalıb: country, city, language. Salam vermə, izah etmə, soruşma. Yalnız de: 'Bağlantı bərpa olundu. Thomas kartından davam edirik.'"*

---

## 3. Funksiyalar (müəllimin tətbiqə "düymələri")

| Funksiya | Müəllim nə vaxt çağırır | Parametrlər |
|---|---|---|
| `log_mistake` | Səhv düzəldəndə, **danışmazdan əvvəl** | wrong, correct, explanation |
| `mark_correct` | Cümlə düzgün olanda | card, field (name/age/country/city/language), **heard**, **pronunciation** |
| `show_card` | Yalnız tətbiq kart dəyişdirildiyini deyəndə | index |

---

## 4. Müəllimə gedən sistem təlimatı (qısa tərcümə)

Tam ingiliscə mətn `almanca/prompt.js` faylında, `cardPrompt` funksiyasındadır. Məzmunu:

**Rol:** Ciddi, amma mehriban alman dili müəllimi. Şagird A1.1-dir, ana dili azərbaycancadır.

**Kartlar:** 9 kartın hamısı və hər biri üçün 5 düzgün cümlə (məs. *Ich heiße Thomas. / Ich bin 35 Jahre alt. / Ich komme aus Deutschland. / Ich wohne in Hamburg. / Ich spreche Deutsch.*). "Yalnız bu faktlar düzgündür."

**Dərs ssenarisi:**
1. Tapşırığı **yalnız bir dəfə** izah et (hazır azərbaycanca cümlə verilib).
2. Addım-addım: ekran növbəti cümləni göstərir, sən addımları elan etmirsən.
3. Hər cümləni yoxla: qrammatika (ich + düzgün fel, Jahre alt, aus/in, aus der Schweiz/Türkei, aus den USA), faktlar (kartla eyni). Qəbul olunan variantlar: "Mein Name ist …", "Ich bin …" (ad üçün).
4. Səhvləri dərhal, bir-bir düzəlt. Şagird düzgün təkrar etməyincə davam etmə.
5. **Tələffüz:** ei = "ay", eu = "oy", j = "y", z = "ts", sondakı -e eşidilməlidir. Fərqli səslənirsə: səhvdir.
6. **Fel sonluqları:** şagird **bilərəkdən** səhv sonluq deyir (kommet, wohnt, heißt…). Hər felin sonuna qulaq as. `heard`-ə eşitdiyini yaz, düzəltmə.
7. Düzgün cümlədən sonra **yalnız** qısa tərif ("Super!"). Heç vaxt "adını de", "şəhərini de" demə.
8. **Kart nömrəsinə tətbiq qərar verir.** Kart bitəndə tətbiqin verdiyi cümləni bir dəfə de.
9. Sonda səhvlərin siyahısı və tərif.

**Düzəltmə qaydaları (bütün dərslər üçün):**
- Hər sözə qulaq as: şəxs sonluqları (ich -e, du -st, er -t …), bin/bist/ist, söz sırası.
- Aksent səhv deyil. "[App]" ilə başlayan mesajlar tətbiqdəndir: onlara səssizcə əməl et.
- Səhv varsa: əvvəlcə `log_mistake`, sonra 1 cümləlik azərbaycanca izah → düzgün cümlə yavaş → "bütün cümləni təkrar et".
- İzah yalnız **indi deyilən** cümlə haqqında olmalıdır.
- Söz səhvləri də səhvdir (heise, Doichland, Hamburk).
- Eşitməmisənsə: "Wie bitte?" de, təxmin etmə.

**Mövzuda qal:** Dərsdən kənar suala cavab vermə: *"Bu dərsin mövzusu deyil. Gəl dərsə davam edək."* Addımı unutma, irəli/geri tullanma.

---

## 5. Tətbiqin müəllimə göndərdiyi mesajlar

| Nə vaxt | Mesaj (qısa) |
|---|---|
| Başlanğıc | `Hallo! Bitte beginne jetzt die Lektion.` |
| ✓ qoyuldu | "ticked … Yalnız 'Super!' de. Növbəti addım: … Addımı elan etmə." |
| ✓ rədd edildi | "REJECTED … Şagird dedi: '…'. Səhv: … Bu məzmunla azərbaycanca izah et: … Düzgün cümləni de, bütün cümləni təkrar etdir." |
| 3-cü uğursuz cəhd | "Bir dəfə də düzgün de, 'Bunu sonra yenə məşq edərik, davam edək' de." |
| Tələffüz "wrong" | "NOT TICKED … log_mistake çağır, izah et, təkrar etdir." |
| Kart bitdi | "CARD X COMPLETE … Bunu bir dəfə de: 'Super! İndi N-ci kart: Ad.'" |
| Səhv kart nömrəsi | "IGNORED. Cari kart N (Ad)." |
| Müəllim səhvi buraxıb | "[App] Grammar check: … səhvdir, indi səsli düzəlt." |
| 8 san cavab yoxdur | "[App] The learner has finished speaking. Respond now…" |
| Bağlantı bərpası | "[App] … Kart, düzgün/qalan sahələr … yalnız 'Bağlantı bərpa olundu…' de." |
| Kartı özün dəyişəndə | "[App] The learner switched to card N." |

---

## 6. "kommet" niyə hələ də keçir: zəif nöqtə

Səs → 3 hakim → ✓

1. **ASR yazısı:** "kommet"-i **"komme" kimi yazır** → tətbiq səhvi görmür.
2. **Müəllimin `heard` mətni:** model də dil modelidir, eşitdiyini çox vaxt **avtomatik düzəldir** və "komme" yazır. Yəni `heard` də "komme" gəlir.
3. **Qrammatika yoxlayıcısı:** yalnız yuxarıdakı iki mətnə baxır, hər ikisi düzəldilmiş gəlir.

Nəticə: səhv sonluğu eşidə biləcək **yeganə** yer səsin özüdür. Hazırkı üç hakimin hamısı mətnə və ya modelin "dürüstlüyünə" güvənir.

### Seçimlər (sən seçirsən, hələ heç biri edilməyib)

**Seçim 1: Ayrıca "hərfi yazı" yoxlaması** (ən etibarlısı)
Hər düymə basılanda sənin səsin ayrıca qeyd olunur və adi Gemini modelinə (səs dərsi yox) göndərilir. Ona sərt təlimat verilir: *"Yalnız eşitdiyini hərf-hərf yaz, heç vaxt düzəltmə."* Tətbiq bu mətni kartdakı cümlə ilə müqayisə edir. ✓ yalnız bu yoxlamadan keçəndə qoyulur.
- Müsbət: sonluqları daha yaxşı tutur, müəllimdən asılı deyil.
- Mənfi: hər cümləyə ~1–2 san gecikmə, pulsuz limitdən əlavə sorğu.

**Seçim 2: ASR-i "hərfi" rejimə keçirmək**
Live API-də yazıya çevirmə üçün `mode: VERBATIM` ayarı var. Bu, düzəltmənin qarşısını qismən ala bilər.
- Müsbət: sadədir, gecikmə yoxdur.
- Mənfi: bizim səs modelində işləyib-işləmədiyi bəlli deyil. Sınamaq lazımdır, işləməsə tətbiq ayarsız qoşulur.

**Seçim 3: Özünü yoxlama**
Hər ✓-dən sonra çatda kiçik **"Əslində səhv demişdim"** düyməsi. Bassan, ✓ götürülür, səhv dəftərə yazılır, müəllim düzəltdirir.
- Müsbət: 100% sənin nəzarətində.
- Mənfi: avtomatik deyil.

**Seçim 4: Hamısı birlikdə** (2 + 1, ehtiyat üçün 3).

---

**Növbəti addım:** Hansı seçimi istədiyini, ya da yuxarıdakı axında nəyi necə dəyişmək istədiyini yaz. Yalnız onu edəcəyəm, başqa heç nəyə toxunmayacağam.
