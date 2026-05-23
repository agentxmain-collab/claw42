import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { dispatchTopics } from "../fixtureData";
import { TopicBody } from "../TopicBody";

function countOccurrences(value: string, needle: string) {
  return value.split(needle).length - 1;
}

function firstSummarySpan(html: string) {
  const summaryHtml = html.match(/<div class="msg-summary">([\s\S]*?)<\/div>/)?.[1] ?? "";
  return summaryHtml.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "";
}

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

  test("collapses a long public rationale even without a separate summary", () => {
    const sourceTopic = dispatchTopics[0]!;
    const longContent =
      "这是一个很长的分析段落，用来验证角色发言默认折叠但完整文本仍然留在 DOM 中。".repeat(5);
    const topic = {
      ...sourceTopic,
      id: "long-message-topic",
      stages: [{ id: "long-message-stage-1", label: "阶段 1 · 信息收集", status: "done" as const }],
      messages: [
        {
          ...sourceTopic.messages[0]!,
          id: "long-message-1",
          stageId: "long-message-stage-1",
          content: longContent,
          oneLineSummary: undefined,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <TopicBody
        topic={topic}
        bodyId="long-message-body"
        messageLabels={{ expand: "展开全文", collapse: "收起" }}
      />,
    );

    expect(html).toContain("展开全文");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="msg-detail-long-message-1" hidden="" class="msg-detail"');
    expect(html).toContain(longContent);
  });

  test("keeps long decision summaries compact while preserving expandable detail", () => {
    const sourceTopic = dispatchTopics[0]!;
    const topic = {
      ...sourceTopic,
      id: "compact-summary-topic",
      stages: [{ id: "compact-stage-1", label: "阶段 4 · 风险审查", status: "done" as const }],
      messages: [
        {
          ...sourceTopic.messages[0]!,
          id: "compact-summary-message-1",
          stageId: "compact-stage-1",
          oneLineSummary:
            "核心失效模式是BTC 76.5K支撑位若被跌破，将触发高贝塔资产（NEAR、HYPE）的补跌，而非继续轮动。当前NEAR 24h涨幅21%、HYPE涨幅4%。",
          content: "完整内容包含完整判断与更多上下文，展开后应能看到这一段。",
        },
      ],
    };

    const html = renderToStaticMarkup(<TopicBody topic={topic} bodyId="compact-summary-body" />);
    const summaryHtml = firstSummarySpan(html);

    expect(summaryHtml).toContain("核心失效模式是BTC");
    expect(summaryHtml).not.toContain("当前NEAR");
    expect(html).toContain("展开全文");
    expect(html).toContain("完整内容包含完整判断与更多上下文");
  });

  test("forces expand control for a long oneLineSummary without punctuation even when content matches", () => {
    const sourceTopic = dispatchTopics[0]!;
    const longText =
      "BTC 24小时下跌2.84%至75258美元，跌破76000心理支撑位，ETH、SOL、HYPE、ZEC全线放量下行，恐慌指数28处于极度恐惧区间但未完成反转确认";
    const topic = {
      ...sourceTopic,
      id: "long-summary-no-punctuation-topic",
      stages: [
        {
          id: "long-summary-no-punctuation-stage-1",
          label: "阶段 2 · 多空辩论",
          status: "done" as const,
        },
      ],
      messages: [
        {
          ...sourceTopic.messages[0]!,
          id: "long-summary-no-punctuation-message-1",
          stageId: "long-summary-no-punctuation-stage-1",
          oneLineSummary: longText,
          content: longText,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <TopicBody topic={topic} bodyId="long-summary-no-punctuation-body" />,
    );
    const summaryHtml = firstSummarySpan(html);

    expect(summaryHtml).toContain("BTC 24小时下跌2.84%");
    expect(summaryHtml).toContain("...");
    expect(summaryHtml).not.toContain("但未完成反转确认");
    expect(html).toContain("展开全文");
    expect(html).toContain('id="msg-detail-long-summary-no-punctuation-message-1" hidden=""');
    expect(html).toContain(longText);
  });

  test("does not render the same PM summary twice when summary and content match", () => {
    const sourceTopic = dispatchTopics[0]!;
    const duplicateText = "团队形成一致看多共识，核心逻辑是资金回流和波动回升。";
    const topic = {
      ...sourceTopic,
      id: "duplicate-summary-topic",
      stages: [{ id: "duplicate-stage-1", label: "阶段 5 · 最终决策", status: "done" as const }],
      messages: [
        {
          ...sourceTopic.messages[0]!,
          id: "duplicate-summary-message-1",
          stageId: "duplicate-stage-1",
          agentId: "portfolio_manager" as const,
          agentName: "首席投资官",
          oneLineSummary: duplicateText,
          content: duplicateText,
        },
      ],
    };

    const html = renderToStaticMarkup(<TopicBody topic={topic} bodyId="duplicate-summary-body" />);

    expect(countOccurrences(html, duplicateText)).toBe(1);
    expect(html).not.toContain("展开全文");
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

  test("keeps expanded detail at body text weight below candidate summary", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/modules/agent-watch/v9/dispatchConsoleV9.module.css"),
      "utf8",
    );

    const triggerRule = css.slice(
      css.indexOf(".root :global(.trigger-text) {"),
      css.indexOf(".root :global(.topic-body) {"),
    );
    const summaryRule = css.slice(
      css.indexOf(".root :global(.msg-summary) {"),
      css.indexOf(".root :global(.msg-expand) {"),
    );
    const detailRule = css.slice(
      css.indexOf(".root :global(.msg-detail) {"),
      css.indexOf(".root :global(.msg-detail[hidden]) {"),
    );

    expect(triggerRule).toContain("font-size: 18px");
    expect(summaryRule).toContain("font-size: 16px");
    expect(detailRule).toContain("font-size: 13px");
    expect(detailRule).toContain("font-weight: 400");
  });
});
