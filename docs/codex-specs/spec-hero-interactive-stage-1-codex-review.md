# Codex Stage 1 Review

## Q1 四段切分

**GO with adjustment.** 5% / 20% / 50% 的切分适合 Stage 1：5% 内不动能避免日常噪声，20% 以内线性轻微放大/缩小，50% 以内进入明确视觉差异。建议实现时保留阈值，但把输出统一 clamp 到安全区间，避免负向极值把币缩到不可点击。

## Q2 上限

**GO.** 1.5x 上限在 80px desktop slot 和 56px mobile slot 内能撑住，但组件必须用固定尺寸 slot 包住 transform scale，避免放大时推动布局。Stage 1 不需要把 +500% 以上再映射得更夸张。

## Q3 动画

**推荐 spring。** 币的涨缩是响应式状态变化，使用 `transition: { type: "spring", damping: 20, stiffness: 200 }` 更像产品 demo 里的物理反馈；mini player slide-in 可继续用 duration/easeOut。prefers-reduced-motion 时应关闭 spring 位移或压缩到短 fade。

## Q4 极端跌幅

**GO with adjustment.** 不建议为 `< -90%` 做闪烁警告，闪烁会增加 a11y 风险，也可能让 hero 看起来像风险警报产品。建议保留 scale 公式，并给极端跌幅加非闪烁状态：低饱和度 / 灰度 / down badge。Stage 1 可先提供 `isExtremeDrop` 状态给 UI 使用。

## 实施建议

- 保留 § 3.2 映射阈值，输出 clamp 到 `[0.5, 1.5]`。
- 固定 coin slot 尺寸，所有涨缩只用 GPU transform。
- 涨缩 transition 用 spring；抓爪和 mini player 分段动画用 reduced-motion 分支。
- `< -90%` 只做静态 extreme-drop 视觉状态，不做闪烁。
