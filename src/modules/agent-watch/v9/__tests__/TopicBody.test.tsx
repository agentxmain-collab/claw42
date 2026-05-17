import React from "react";
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
});
