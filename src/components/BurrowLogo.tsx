export function BurrowLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="47" stroke="#E8B44D" strokeWidth="3" />
      <circle cx="50" cy="50" r="39" stroke="#E8B44D" strokeWidth="1.5" />
      <text
        x="50"
        y="68"
        textAnchor="middle"
        fill="#E8B44D"
        fontSize="52"
        fontFamily="'Brush Script MT', 'Segoe Script', cursive"
      >
        B
      </text>
    </svg>
  )
}
