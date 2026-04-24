import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Sparkline({ data, color = '#10b981', fillColor, width = 120, height = 40, strokeWidth = 1.5, }) {
    if (!data.length)
        return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = Math.max(max - min, 1);
    const pad = strokeWidth;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const px = (i) => pad + (i / (data.length - 1)) * w;
    const py = (v) => pad + h - ((v - min) / range) * h;
    const linePath = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ');
    const areaPath = `${linePath} L ${px(data.length - 1)} ${height} L ${px(0)} ${height} Z`;
    const id = `spark-${color.replace('#', '')}-${Math.random().toString(36).slice(2, 6)}`;
    const lastY = py(data[data.length - 1]);
    const lastX = px(data.length - 1);
    return (_jsxs("svg", { width: width, height: height, viewBox: `0 0 ${width} ${height}`, className: "overflow-visible", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: id, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: fillColor ?? color, stopOpacity: "0.35" }), _jsx("stop", { offset: "100%", stopColor: fillColor ?? color, stopOpacity: "0" })] }) }), _jsx("path", { d: areaPath, fill: `url(#${id})` }), _jsx("path", { d: linePath, fill: "none", stroke: color, strokeWidth: strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("circle", { cx: lastX, cy: lastY, r: 3, fill: color }), _jsx("circle", { cx: lastX, cy: lastY, r: 5, fill: color, fillOpacity: "0.2" })] }));
}
