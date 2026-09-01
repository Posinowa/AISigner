/**
 * `server-only` paketinin test ortami karsiligi (#321).
 *
 * Bu paketi Next.js sagliyor; vitest altinda cozulemiyor ve sunucu modullerini
 * import eden HER test dosyasi "Cannot find package 'server-only'" ile
 * yuklenemiyor. Depoda bunun icin her dosyaya tek tek
 * `vi.mock("server-only", () => ({}))` yaziliyordu — kolay unutulan, tekrarlayan
 * bir adim (#324 ve #321'de iki kez unutuldu).
 *
 * `vitest.config.ts` bu dosyayi takma ad olarak cozuyor; artik gerekmiyor.
 */
export {};
