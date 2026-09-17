import type { ReactNode } from "react";

/**
 * Form field scaffolding.
 *
 * Native `<input>`, `<select>` and `<textarea>` are used directly with these class
 * strings rather than wrapped in components: the native elements already have the right
 * keyboard behaviour, autofill and mobile keyboards, and wrapping them tends to lose one
 * of those. `Field` supplies the label/hint/error association, which is the part that is
 * actually easy to get wrong.
 */

export const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text-1 placeholder:text-text-3 focus:border-accent";

export const selectClass = `${inputClass} appearance-none bg-[length:1rem] pr-9`;

export function Field({
  label,
  htmlFor,
  hint,
  errors,
  children,
  className = "",
}: {
  label: ReactNode;
  /** Must match the control's `id` so the label is programmatically associated. */
  htmlFor: string;
  hint?: ReactNode;
  errors?: string[];
  children: ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = errors?.length ? `${htmlFor}-error` : undefined;

  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-2">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mt-0.5 text-xs leading-snug text-text-3">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {errors?.length ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A checkbox, its label and its hint, as one row.
 *
 * A real `<input type="checkbox">` rather than a styled button with `aria-checked`: the
 * native control already announces its state, responds to space, and participates in form
 * reset. `accent-accent` tints the native check with the theme's accent colour, which keeps
 * it correct when the dosha hue shifts.
 */
export function CheckboxField({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-accent"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-text-2">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="mt-0.5 text-xs leading-snug text-text-3">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A radio group rendered as a row of cards.
 *
 * Used for every "pick one of a few" choice in onboarding and settings. The real radios
 * stay in the DOM (visually hidden, not removed) so arrow-key navigation, screen readers
 * and form semantics all keep working.
 */
export function ChoiceGroup<T extends string>({
  name,
  legend,
  hint,
  value,
  options,
  onChange,
  columns = 2,
}: {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  value: T;
  options: readonly { value: T; label: string; detail?: string }[];
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}) {
  const grid = columns === 1 ? "grid-cols-1" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <fieldset>
      <legend className="text-sm font-medium text-text-2">{legend}</legend>
      {hint ? <p className="mt-0.5 text-xs leading-snug text-text-3">{hint}</p> : null}
      <div className={`mt-2 grid gap-2 ${grid}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-line bg-surface-2 hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium text-text-1">{option.label}</span>
              {option.detail ? (
                <span className="text-xs leading-snug text-text-3">{option.detail}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
