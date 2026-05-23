import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { dispatchTopics } from "../fixtureData";
import { TopicBody } from "../TopicBody";

describe("TopicBody", () => {
  test("hides unreached pending stages for an active in-progress topic", () => {
    const sourceTopic = dispatchTopics[0]!;
    const topic = {
      ...sourceTopic,
      id: "active-stage-topic",
      status: "active" as const,
      stages: [
        { id: "active-stage-topic-stage-1", label: "阶段 1 · 信息收集", status: "done" as const },
        { id: "active-stage-topic-stage-2", label: "阶段 2 · 多空辩论", status: "done" as const },
        {
          id: "active-stage-topic-stage-3",
          label: "阶段 3 · 交易方案 · 进行中",
          status: "in_progress" as const,
          note: "该阶段正在写入部分结果",
        },
        {
          id: "active-stage-topic-stage-4",
          label: "阶段 4 · 风险审查",
          status: "pending" as const,
          note: "等待风险审查",
        },
      ],
      messages: [
        {
          ...sourceTopic.messages[0]!,
          id: "active-stage-message-1",
          stageId: "active-stage-topic-stage-1",
        },
      ],
    };

    const html = renderToStaticMarkup(<TopicBody topic={topic} bodyId="active-stage-body" />);

    expect(html).toContain("阶段 3 · 交易方案 · 进行中");
    expect(html).toContain("该阶段正在写入部分结果");
    expect(html).not.toContain("阶段 4 · 风险审查");
    expect(html).not.toContain("等待风险审查");
  });

  test("collapses detailed agent rationale behind an accessible control", () => {
    const sourceTopic = dispatchTopics[0]!;
    const topic = {
      ...sourceTopic,
      id: "expandable-message-topic",
      stages: [{ id: "expandable-stage-1", label: "阶段 1 · 信息收集", status: "done" as const }],
      messages: [
        {
          ...sourceTopic.messages[0]!,
          id: "expandable-message-1",
          stageId: "expandable-stage-1",
          oneLineSummary: "主结论只看这一行",
          content: "这里是默认折叠的完整分析内容，但仍保留在 DOM 里。",
        },
      ],
    };

    const html = renderToStaticMarkup(<TopicBody topic={topic} bodyId="expandable-body" />);

    expect(html).toContain("主结论只看这一行");
    expect(html).toContain("展开全文");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="msg-detail-expandable-message-1"');
    expect(html).toContain('id="msg-detail-expandable-message-1" hidden="" class="msg-detail"');
    expect(html).toContain("这里是默认折叠的完整分析内容，但仍保留在 DOM 里。");
  });

  test("keeps collapsed detail visually hidden even though detail nodes are block-level", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/modules/agent-watch/v9/dispatchConsoleV9.module.css"),
      "utf8",
    );

    const detailDisplayRule = css.indexOf(".root :global(.msg-detail) {");
    const hiddenDetailRule = css.indexOf(".root :global(.msg-detail[hidden]) {");

    expect(detailDisplayRule).toBeGreaterThanOrEqual(0);
    expect(hiddenDetailRule).toBeGreaterThan(detailDisplayRule);
    expect(css.slice(hiddenDetailRule, hiddenDetailRule + 90)).toContain("display: none");
  });
});
