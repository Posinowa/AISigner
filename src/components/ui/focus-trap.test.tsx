// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getFocusable, handleTabKey } from "./focus-trap";

let container: HTMLDivElement;
let first: HTMLButtonElement;
let last: HTMLButtonElement;

beforeEach(() => {
  container = document.createElement("div");
  first = document.createElement("button");
  first.textContent = "İlk";
  const middle = document.createElement("input");
  last = document.createElement("button");
  last.textContent = "Son";
  const disabled = document.createElement("button");
  disabled.textContent = "Pasif";
  disabled.setAttribute("disabled", "");
  container.append(first, middle, last, disabled);
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.innerHTML = "";
});

function tab(shift = false): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift, cancelable: true });
}

describe("getFocusable (#126-5 / #160)", () => {
  it("odaklanabilir elemanları döner, disabled'ı hariç tutar", () => {
    const items = getFocusable(container);
    expect(items).toHaveLength(3); // button, input, button (disabled hariç)
    expect(items[0]).toBe(first);
    expect(items[items.length - 1]).toBe(last);
  });

  it("role='button' olan elemanları dahil eder; aria-disabled ve tabindex=-1 olanları hariç tutar", () => {
    const customDiv = document.createElement("div");
    const roleBtn = document.createElement("div");
    roleBtn.setAttribute("role", "button");
    roleBtn.setAttribute("tabindex", "0");

    const disabledRoleBtn = document.createElement("div");
    disabledRoleBtn.setAttribute("role", "button");
    disabledRoleBtn.setAttribute("aria-disabled", "true");

    const tabIndexMinusBtn = document.createElement("div");
    tabIndexMinusBtn.setAttribute("role", "button");
    tabIndexMinusBtn.setAttribute("tabindex", "-1");

    customDiv.append(roleBtn, disabledRoleBtn, tabIndexMinusBtn);
    document.body.appendChild(customDiv);

    const items = getFocusable(customDiv);
    expect(items).toHaveLength(1);
    expect(items[0]).toBe(roleBtn);
  });

  it("hidden, aria-hidden='true' veya display:none olan elemanları hariç tutar", () => {
    const customDiv = document.createElement("div");

    const visibleBtn = document.createElement("button");
    visibleBtn.textContent = "Görünür";

    const hiddenBtn = document.createElement("button");
    hiddenBtn.hidden = true;

    const ariaHiddenBtn = document.createElement("button");
    ariaHiddenBtn.setAttribute("aria-hidden", "true");

    const displayNoneBtn = document.createElement("button");
    displayNoneBtn.style.display = "none";

    customDiv.append(visibleBtn, hiddenBtn, ariaHiddenBtn, displayNoneBtn);
    document.body.appendChild(customDiv);

    const items = getFocusable(customDiv);
    expect(items).toHaveLength(1);
    expect(items[0]).toBe(visibleBtn);
  });

  it("null container'da boş dizi döner", () => {
    expect(getFocusable(null)).toEqual([]);
  });
});

describe("handleTabKey (#126-5)", () => {
  it("son elemanda Tab → ilk elemana sarar (preventDefault)", () => {
    last.focus();
    const e = tab();
    const prevent = vi.spyOn(e, "preventDefault");
    handleTabKey(container, e);
    expect(prevent).toHaveBeenCalled();
    expect(document.activeElement).toBe(first);
  });

  it("ilk elemanda Shift+Tab → son elemana sarar", () => {
    first.focus();
    const e = tab(true);
    const prevent = vi.spyOn(e, "preventDefault");
    handleTabKey(container, e);
    expect(prevent).toHaveBeenCalled();
    expect(document.activeElement).toBe(last);
  });

  it("ortadaki elemanda Tab → müdahale etmez (tarayıcı doğal akışı)", () => {
    first.focus();
    const e = tab();
    const prevent = vi.spyOn(e, "preventDefault");
    handleTabKey(container, e);
    expect(prevent).not.toHaveBeenCalled();
  });

  it("Tab dışındaki tuşlarda hiçbir şey yapmaz", () => {
    const e = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    const prevent = vi.spyOn(e, "preventDefault");
    handleTabKey(container, e);
    expect(prevent).not.toHaveBeenCalled();
  });
});
