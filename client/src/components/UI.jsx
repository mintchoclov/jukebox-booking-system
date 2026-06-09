export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-beige ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-primary text-navy',
    secondary: 'bg-pink text-navy',
    muted: 'bg-beige text-navy',
    ghost: 'text-navy opacity-40',
  }
  return (
    <button
      className={`font-medium py-3 rounded-full text-sm ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-beige text-navy',
    primary: 'bg-primary text-navy',
    pink: 'bg-pink text-navy',
    success: 'bg-success text-successText',
    danger: 'bg-danger text-dangerText',
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function SectionLabel({ children }) {
  return (
    <p className="text-xs font-medium text-navy opacity-40 uppercase tracking-wider mb-3">
      {children}
    </p>
  )
}

export function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
  )
}

export function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-navy mb-1">
      {children}
    </label>
  )
}

export function ErrorText({ children }) {
  return children
    ? <p className="text-dangerText text-xs mb-4">{children}</p>
    : null
}