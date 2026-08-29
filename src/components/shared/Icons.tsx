interface IconProps {
  className?: string
}

/** Keep in sync with src/assets/pixen-logo.svg, which generates the app icon. */
export const PixenLogo = ({ className }: IconProps) => {
  return (
    <svg className={className} fill="none" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <rect height="204" rx="46" stroke="#7C5CFF" strokeWidth="18" width="204" x="26" y="26" />
      <rect fill="#7C5CFF" height="52" rx="13" width="52" x="74" y="74" />
      <rect fill="#4C3BD6" height="52" rx="13" width="52" x="130" y="74" />
      <rect fill="#B7A6FF" height="52" rx="13" width="52" x="130" y="130" />
    </svg>
  )
}
