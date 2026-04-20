type Props = {
  data: number[];
  color?: string;
  fillColor?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
};

export default function Sparkline({
  data,
  color = '#10b981',
  fillColor,
  width = 120,
  height = 40,
  strokeWidth = 1.5,
}: Props) {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1);

  const pad = strokeWidth;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const px = (i: number) => pad + (i / (data.length - 1)) * w;
  const py = (v: number) => pad + h - ((v - min) / range) * h;

  const linePath = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ');
  const areaPath = `${linePath} L ${px(data.length - 1)} ${height} L ${px(0)} ${height} Z`;

  const id = `spark-${color.replace('#', '')}-${Math.random().toString(36).slice(2, 6)}`;
  const lastY = py(data[data.length - 1]);
  const lastX = px(data.length - 1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor ?? color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fillColor ?? color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${id})`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {/* Last-value dot */}
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
      <circle cx={lastX} cy={lastY} r={5} fill={color} fillOpacity="0.2" />
    </svg>
  );
}
