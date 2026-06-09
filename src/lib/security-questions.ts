/**
 * Önceden tanımlı güvenlik soruları listesi.
 * questionId olarak index (0, 1, 2...) kullanılır.
 * Kayıt sırasında kullanıcı bunlardan 3 tanesini seçip cevaplar.
 */
export const SECURITY_QUESTIONS = [
  "İlk evcil hayvanınızın adı neydi?",
  "İlk okulunuzun adı neydi?",
  "Annenizin kızlık soyadı nedir?",
  "En sevdiğiniz film hangisidir?",
  "Doğduğunuz şehir neresidir?",
  "En yakın arkadaşınızın adı nedir?",
  "İlk işinizin adı neydi?",
  "En sevdiğiniz kitap hangisidir?",
  "Çocukluğunuzda yaşadığınız sokağın adı neydi?",
  "En sevdiğiniz yemek nedir?",
] as const;

export const REQUIRED_ANSWERS = 3;
