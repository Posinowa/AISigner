// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownContent } from "./MarkdownContent";

describe("MarkdownContent — biçimlendirme (#126-2)", () => {
  it("kalın ve satır içi kodu render eder", () => {
    const { container } = render(<MarkdownContent>{"**kalın** ve `kod`"}</MarkdownContent>);
    expect(container.querySelector("strong")).toHaveTextContent("kalın");
    expect(container.querySelector("code")).toHaveTextContent("kod");
  });

  it("sıralı listeyi render eder (eski chat renderer'ı bunu düz metin bırakıyordu)", () => {
    const { container } = render(<MarkdownContent>{"1. bir\n2. iki"}</MarkdownContent>);
    expect(container.querySelector("ol")).toBeInTheDocument();
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("bağlantıyı güvenli özniteliklerle render eder", () => {
    render(<MarkdownContent>{"[site](https://example.com)"}</MarkdownContent>);
    const link = screen.getByRole("link", { name: "site" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("madde işaretli listeyi ve başlığı render eder", () => {
    const { container } = render(<MarkdownContent>{"## Başlık\n\n- a\n- b"}</MarkdownContent>);
    expect(container.querySelector("h2")).toHaveTextContent("Başlık");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
  });
});

describe("MarkdownContent — XSS güvenliği (#126-2)", () => {
  it("ham HTML'i element olarak render ETMEZ (script enjeksiyonu yok)", () => {
    const { container } = render(
      <MarkdownContent>{'<script>alert(1)</script><img src=x onerror="alert(1)">'}</MarkdownContent>,
    );
    // react-markdown varsayılan olarak ham HTML'i çalıştırmaz (rehype-raw yok).
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("javascript: şemalı bağlantıyı href olarak geçirmez", () => {
    const { container } = render(
      <MarkdownContent>{"[tıkla](javascript:alert(1))"}</MarkdownContent>,
    );
    const link = container.querySelector("a");
    // react-markdown güvensiz şemaları temizler; link ya yok ya da href zararsız.
    expect(link?.getAttribute("href") ?? "").not.toContain("javascript:");
  });
});
