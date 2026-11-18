import { describe, it, expect } from "vitest";
import { danismaKayitlari, degerlendir } from "./audit-gate.mjs";

const ISTISNA = [
  { ghsa: "GHSA-aaaa-bbbb-cccc", paket: "picomatch", gerekce: "test", sonTarih: "2027-01-31" },
];

function kayit(name: string, ghsa: string, severity: string) {
  return {
    source: Math.floor(Math.random() * 1e9),
    name,
    title: `${name} açığı`,
    url: `https://github.com/advisories/${ghsa}`,
    severity,
    range: "*",
  };
}

/** picomatch açığı + onu yansıtan ara paketler (npm audit --json şekli). */
function rapor(ekVia: Record<string, unknown[]> = {}) {
  const picomatch = kayit("picomatch", "GHSA-aaaa-bbbb-cccc", "high");
  return {
    vulnerabilities: {
      picomatch: { severity: "high", via: [picomatch] },
      fdir: { severity: "high", via: ["picomatch"] },
      "@sentry/nextjs": { severity: "high", via: ["@rollup/plugin-commonjs"] },
      ...Object.fromEntries(
        Object.entries(ekVia).map(([ad, via]) => [ad, { severity: "high", via }]),
      ),
    },
  };
}

describe("audit-gate — tek GHSA istisnası", () => {
  it("ara paketler ayrı kayıt sayılmaz; yaprak kayıt tekilleşir", () => {
    const r = rapor();
    r.vulnerabilities.fdir.via.push(r.vulnerabilities.picomatch.via[0] as never);
    expect(danismaKayitlari(r)).toHaveLength(1);
  });

  it("istisnadaki GHSA süresi içinde bloke etmez", () => {
    const { engelleyen, muaf } = degerlendir(rapor(), "2026-11-18", ISTISNA);
    expect(engelleyen).toHaveLength(0);
    expect(muaf).toHaveLength(1);
  });

  it("süresi dolunca yeniden bloke eder", () => {
    const { engelleyen, suresiDolan } = degerlendir(rapor(), "2027-02-01", ISTISNA);
    expect(engelleyen).toHaveLength(1);
    expect(suresiDolan).toHaveLength(1);
  });

  it("aynı paketteki BAŞKA bir açık bloke eder", () => {
    const r = rapor({ x: [kayit("picomatch", "GHSA-zzzz-yyyy-xxxx", "critical")] });
    const { engelleyen } = degerlendir(r, "2026-11-18", ISTISNA);
    expect(engelleyen.map((k) => k.ghsa)).toEqual(["GHSA-zzzz-yyyy-xxxx"]);
  });

  it("aynı GHSA başka pakette çıkarsa bloke eder", () => {
    const r = rapor({ fdir2: [kayit("fdir", "GHSA-aaaa-bbbb-cccc", "high")] });
    const { engelleyen } = degerlendir(r, "2026-11-18", ISTISNA);
    expect(engelleyen.map((k) => k.paket)).toEqual(["fdir"]);
  });

  it("moderate/low bloke etmez (eşik eskisiyle aynı)", () => {
    const r = rapor({ nodemailer: [kayit("nodemailer", "GHSA-mmmm-mmmm-mmmm", "moderate")] });
    expect(degerlendir(r, "2026-11-18", ISTISNA).engelleyen).toHaveLength(0);
  });
});
