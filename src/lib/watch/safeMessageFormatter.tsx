import React from "react";

function makeKey(kind: string, index: number) {
  return `${kind}-${index}`;
}

export function formatSafeContent(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let index = 0;
  let textStart = 0;

  function flushText(end: number) {
    if (end <= textStart) return;
    nodes.push(content.slice(textStart, end));
  }

  while (index < content.length) {
    if (content[index] === "\n") {
      flushText(index);
      nodes.push(<br key={makeKey("br", index)} />);
      index += 1;
      textStart = index;
      continue;
    }

    if (content.startsWith("**", index)) {
      const closeIndex = content.indexOf("**", index + 2);
      if (closeIndex !== -1) {
        flushText(index);
        nodes.push(
          <strong key={makeKey("strong", index)}>{content.slice(index + 2, closeIndex)}</strong>,
        );
        index = closeIndex + 2;
        textStart = index;
        continue;
      }
    }

    if (content[index] === "_") {
      const closeIndex = content.indexOf("_", index + 1);
      if (closeIndex > index + 1) {
        flushText(index);
        nodes.push(<em key={makeKey("em", index)}>{content.slice(index + 1, closeIndex)}</em>);
        index = closeIndex + 1;
        textStart = index;
        continue;
      }
    }

    index += 1;
  }

  flushText(content.length);
  return nodes;
}
