const STAR_CENTER_X = 60;
const STAR_CENTER_Y = 60;
const STAR_LONG_TIP_RADIUS = 57;
const STAR_SHORT_TIP_RADIUS = 40;
const STAR_BASE_RADIUS = 15;
const STAR_LONG_SPREAD = 12;
const STAR_SHORT_SPREAD = 10;
const STAR_DIRECTIONS = 8;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toPoint(angleDeg, radius) {
  const angle = toRadians(angleDeg);
  return {
    x: STAR_CENTER_X + Math.cos(angle) * radius,
    y: STAR_CENTER_Y + Math.sin(angle) * radius,
  };
}

function toPointString(point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function buildSpokes() {
  return Array.from({ length: STAR_DIRECTIONS }, (_, index) => {
    const angleDeg = -90 + index * 45;
    const isCardinalDirection = index % 2 === 0;
    const tipRadius = isCardinalDirection ? STAR_LONG_TIP_RADIUS : STAR_SHORT_TIP_RADIUS;
    const spread = isCardinalDirection ? STAR_LONG_SPREAD : STAR_SHORT_SPREAD;

    const tip = toPoint(angleDeg, tipRadius);
    const left = toPoint(angleDeg - spread, STAR_BASE_RADIUS);
    const right = toPoint(angleDeg + spread, STAR_BASE_RADIUS);

    const lightOnLeft = index % 2 === 0;

    return {
      key: `spoke-${index}`,
      leftPoints: `${STAR_CENTER_X},${STAR_CENTER_Y} ${toPointString(left)} ${toPointString(tip)}`,
      rightPoints: `${STAR_CENTER_X},${STAR_CENTER_Y} ${toPointString(tip)} ${toPointString(right)}`,
      lightOnLeft,
    };
  });
}

const STAR_SPOKES = buildSpokes();

export default function BrandStarSymbol({
  className = "h-9 w-9",
  decorative = true,
  title = "Eight-point star",
  fill = "#F5F5F0",
  split = "#0A0A0A",
  stroke = "#111111",
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden={decorative}
      role={decorative ? undefined : "img"}
    >
      {decorative ? null : <title>{title}</title>}
      {STAR_SPOKES.map((spoke) => (
        <g key={spoke.key}>
          <polygon
            points={spoke.leftPoints}
            fill={spoke.lightOnLeft ? fill : split}
            stroke={stroke}
            strokeWidth="0.85"
            strokeLinejoin="round"
          />
          <polygon
            points={spoke.rightPoints}
            fill={spoke.lightOnLeft ? split : fill}
            stroke={stroke}
            strokeWidth="0.85"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}
