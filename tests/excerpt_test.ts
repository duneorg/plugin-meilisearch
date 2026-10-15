import { assertEquals } from "@std/assert";
import { extractExcerpt } from "../src/excerpt.ts";

Deno.test("extractExcerpt: keeps <mark> highlights, strips other tags", () => {
  assertEquals(
    extractExcerpt("a <b>bold</b> <mark>hit</mark> end", 100),
    "a bold <mark>hit</mark> end",
  );
});

Deno.test("extractExcerpt: nested/malformed markup can't leave a live tag", () => {
  const out = extractExcerpt("<scr<script>ipt>alert(1)</script>", 100);
  assertEquals(out.toLowerCase().includes("<script"), false);
  assertEquals(out.includes("<"), false);
});

Deno.test("extractExcerpt: forged mark sentinels in input are not honored", () => {
  assertEquals(extractExcerpt("x\u0001evil\u0002y", 100), "xevily");
});

Deno.test("extractExcerpt: truncates with ellipsis", () => {
  assertEquals(extractExcerpt("abcdefgh", 3), "abc…");
});

Deno.test("extractExcerpt: truncation never cuts inside a <mark> tag and closes open highlights", () => {
  const out = extractExcerpt("ab <mark>highlighted</mark> tail", 6);
  assertEquals(out, "ab <mark>hig</mark>…");
  assertEquals(
    extractExcerpt("<mark>x</mark>y".repeat(5), 3),
    "<mark>x</mark>y<mark>x</mark>…",
  );
});

Deno.test("extractExcerpt: length is counted in code points, not UTF-16 units", () => {
  assertEquals(extractExcerpt("😀".repeat(8), 10), "😀".repeat(8));
  assertEquals(extractExcerpt("😀".repeat(12), 10), "😀".repeat(10) + "…");
});
