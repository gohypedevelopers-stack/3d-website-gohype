"use client"

const InputField = ({ label, name, type = "text", value, onChange, placeholder, className }: any) => (
  <div className={className}>
    <label htmlFor={name} className="sr-only">
      {label}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-5 py-3.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
    />
  </div>
)

export default InputField
