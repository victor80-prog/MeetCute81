const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = "px-4 py-2 rounded-lg font-medium transition-colors duration-300";
  
  const variantClasses = {
    primary: "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white hover:shadow-lg",
    secondary: "bg-[var(--light)] text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--accent)]",
    outline: "bg-transparent text-[var(--text)] border border-gray-300 hover:bg-gray-50",
  };
  
  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant] || ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;