export function IntensityBar({ value }: { value: number }) {
  return (
    <div className="intensity" aria-label={`激烈度 ${value}/5`}>
      激烈度
      <div className="intensity-dots" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => {
          const dot = index + 1;
          const activeClass = dot <= value ? " on" : "";
          const heatClass = dot < value ? " hot" : dot <= value ? " warm" : "";
          return <span className={`intensity-dot${activeClass}${heatClass}`} key={dot} />;
        })}
      </div>
      <span className="intensity-score">{value}/5</span>
    </div>
  );
}
