import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatSafeContent } from "@/lib/watch/safeMessageFormatter";

function render(content: string) {
  return renderToStaticMarkup(<>{formatSafeContent(content)}</>);
}

describe("formatSafeContent", () => {
  it("renders simple bold, italic, and newline markers", () => {
    expect(render("现价 **80,730**\n状态 _active_")).toBe(
      "现价 <strong>80,730</strong><br/>状态 <em>active</em>",
    );
  });

  it("lets React escape raw html instead of rendering it", () => {
    expect(render("<img src=x onerror=alert(1)> **safe**")).toBe(
      "&lt;img src=x onerror=alert(1)&gt; <strong>safe</strong>",
    );
  });

  it("keeps unclosed markers literal", () => {
    expect(render("等待 **未闭合 <script>")).toBe("等待 **未闭合 &lt;script&gt;");
  });

  it("does not recursively parse nested markers", () => {
    expect(render("**bold _literal_**")).toBe("<strong>bold _literal_</strong>");
  });
});
