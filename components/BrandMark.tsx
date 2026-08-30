export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-mark" aria-label="ظل المدينة">
      <svg
        className="brand-mark__icon"
        viewBox="0 0 42 42"
        role="img"
        aria-hidden="true"
      >
        <path d="M7 31V19.5C7 12.6 12.6 7 19.5 7h15.5v6H19.5A6.5 6.5 0 0 0 13 19.5V31H7Z" />
        <path d="M17 31V21.5A4.5 4.5 0 0 1 21.5 17H35v6H23v8h-6Z" />
        <path d="M27 31v-4h8v4h-8Z" />
      </svg>
      {!compact && (
        <span className="brand-mark__text">
          <strong>ظل المدينة</strong>
        </span>
      )}
    </div>
  );
}
