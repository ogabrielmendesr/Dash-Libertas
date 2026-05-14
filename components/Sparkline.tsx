"use client";

type Props = {
  data: number[];
  stroke?: string;
  fill?: string;
  height?: number;
};

export function Sparkline({ data, stroke = "#ff3da3", fill = "rgba(255,61,163,0.18)", height = 40 }: Props) {
  const W = 200;
  const H = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * (H - 4) - 2;
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `M 0 ${H} L ${data.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" L ")} L ${W} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
