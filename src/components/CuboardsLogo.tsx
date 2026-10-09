type Props = {
  /** Icon only — used in tight mobile headers */
  iconOnly?: boolean;
  className?: string;
};

export function CuboardsLogo({ iconOnly = false, className = '' }: Props) {
  return (
    <span className={`cuboards-logo${iconOnly ? ' cuboards-logo--icon-only' : ''}${className ? ` ${className}` : ''}`}>
      <img
        className="cuboards-logo-mark"
        src="/logo-mark.png"
        width={122}
        height={137}
        alt=""
        decoding="async"
      />
      {!iconOnly && <span className="cuboards-logo-wordmark">Cuboards</span>}
    </span>
  );
}
