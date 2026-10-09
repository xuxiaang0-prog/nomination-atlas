import geometry from "./australia-map.json";
export function AustraliaMap({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (code: string) => void;
}) {
  return (
    <svg
      className="australia-map"
      viewBox={geometry.viewBox}
      aria-label="澳大利亚八个州及领地，按 Tab 可逐一选择"
      role="group"
    >
      {geometry.states.map((s) => (
        <g key={s.code}>
          <path
            d={s.path}
            fillRule="evenodd"
            className={"map-state " + (selected === s.code ? "selected" : "")}
            role="button"
            tabIndex={0}
            aria-label={`${s.name} ${s.code}`}
            onClick={() => onSelect(s.code)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(s.code);
              }
            }}
          />
          {s.code !== "ACT" && (
            <text x={s.label.x} y={s.label.y} aria-hidden="true">
              {s.code}
            </text>
          )}
          {s.code === "ACT" && (
            <>
              <line
                x1={s.centroid.x}
                y1={s.centroid.y}
                x2={s.label.x}
                y2={s.label.y}
              />
              <g
                role="button"
                tabIndex={0}
                aria-label="选择首都领地 ACT（放大点击区域）"
                onClick={() => onSelect("ACT")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect("ACT");
                  }
                }}
              >
                <rect
                  x={s.label.x - 45}
                  y={s.label.y - 35}
                  width="90"
                  height="70"
                  rx="10"
                />
                <text x={s.label.x} y={s.label.y}>
                  ACT
                </text>
              </g>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
