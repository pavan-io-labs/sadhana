"use client";

/**
 * One block, edited: an anchored intention and what it resolves to today.
 *
 * Three decisions here are less obvious than they look.
 *
 * **Numbers are held as text.** An `<input type="number">` holds a string, and an empty one
 * holds `""`. Coercing on every keystroke turns a half-typed `-9` into `0`, and a cleared field
 * into `0` as well  --  which then saves silently. So the draft carries what the input carries,
 * `blockFieldsSchema` does the coercion once at submit, and the preview reads ` -- ` for anything it
 * cannot make sense of rather than guessing a number the user did not type.
 *
 * **The offset is one numeric control for all seven anchors**, rather than a time picker for
 * `clock` and a signed number for the rest. Two controls would need two converters and could
 * disagree; the line underneath resolves the arithmetic live  --  type `390` and it reads back
 * `6:30 AM`  --  which is the feedback a picker would have provided anyway.
 *
 * **Validation is the route's own schema, run here first.** `lib/validators` is pure and has no
 * server import, so the same rules that will accept or reject the request can reject it before it
 * is made. The server still validates; this only means the user hears about a 400 before the
 * round trip, and hears it in the same words.
 *
 * Which is why the form is `noValidate`. The browser's own constraint validation is a *second*
 * validator with different rules, and when it objects it blocks the submit event entirely  --  React
 * never sees the click, so nothing runs and nothing is said. `step` is the trap: it is a validity
 * rule, not just an arrow increment, so `step={1}` made every duration that was not a multiple of
 * five unsaveable in silence, including the two- and three-minute blocks the shipped presets
 * contain. One validator, and it is the one that can explain itself.
 */

import { useId, useMemo, useState } from "react";

import { BlockIcon } from "@/components/blocks/block-icon";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, inputClass, selectClass } from "@/components/ui/field";
import type { DayPlan } from "@/lib/day";
import {
  ANCHOR_META,
  anchorsOf,
  BLOCK_ANCHORS,
  BLOCK_CATEGORIES,
  BLOCK_FUELS,
  BLOCK_ICONS,
  type BlockAnchor,
  type BlockCategory,
  type BlockFuel,
  CATEGORY_META,
  describeMask,
  describeOffset,
  EVERY_DAY,
  FUEL_META,
  maskHas,
  maskToggle,
  resolveAnchor,
  type ScheduleBlock,
  WEEKDAY_LABELS,
  WEEKDAYS_ONLY,
  WEEKEND_ONLY,
} from "@/lib/schedule";
import { formatClock } from "@/lib/time";
import { type BlockFields, blockFieldsSchema, fieldErrors, type FieldErrors } from "@/lib/validators";

/** The form's own state: text where the input holds text, values where it holds a value. */
export type BlockFormState = {
  title: string;
  detail: string;
  category: BlockCategory;
  anchor: BlockAnchor;
  offset: string;
  duration: string;
  fuel: BlockFuel;
  weekdayMask: number;
  notify: boolean;
  notifyLead: string;
  icon: string;
  enabled: boolean;
};

export function formStateOf(block: ScheduleBlock): BlockFormState {
  return {
    title: block.title,
    detail: block.detail,
    category: block.category,
    anchor: block.anchor,
    offset: String(block.offsetMinutes),
    duration: String(block.durationMinutes),
    fuel: block.fuel,
    weekdayMask: block.weekdayMask,
    notify: block.notify,
    notifyLead: String(block.notifyLeadMinutes),
    icon: block.icon,
    enabled: block.enabled,
  };
}

/** A new block starts at sunrise for fifteen minutes, which is the shortest honest default. */
export const NEW_BLOCK: BlockFormState = {
  title: "",
  detail: "",
  category: "practice",
  anchor: "sunrise",
  offset: "0",
  duration: "15",
  fuel: "any",
  weekdayMask: EVERY_DAY,
  notify: false,
  notifyLead: "5",
  icon: "dot",
  enabled: true,
};

/** `null` rather than a guess, so the preview can say so instead of inventing a time. */
function minutesOf(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "-") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.round(value) : null;
}

const MASK_SHORTCUTS: readonly { label: string; mask: number }[] = [
  { label: "Every day", mask: EVERY_DAY },
  { label: "Weekdays", mask: WEEKDAYS_ONLY },
  { label: "Weekends", mask: WEEKEND_ONLY },
];

export function BlockForm({
  plan,
  clock24h,
  initial,
  submitLabel,
  busy,
  serverErrors,
  onSubmit,
  onCancel,
}: {
  plan: DayPlan;
  clock24h: boolean;
  initial: BlockFormState;
  submitLabel: string;
  busy: boolean;
  /** Field errors the server sent back, shown until the same field is edited again. */
  serverErrors: FieldErrors;
  onSubmit: (fields: BlockFields) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [form, setForm] = useState<BlockFormState>(initial);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});

  const set = <K extends keyof BlockFormState>(key: K, value: BlockFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Local errors win: they were produced by this render's values, and the server's were produced
  // by an earlier submit.
  const errors: FieldErrors = { ...serverErrors, ...localErrors };
  const clock = (minute: number) => formatClock(minute, { hour24: clock24h });

  const anchors = useMemo(() => anchorsOf(plan), [plan]);
  const offset = minutesOf(form.offset);
  const duration = minutesOf(form.duration);
  const start = offset === null ? null : resolveAnchor(anchors, form.anchor, offset);
  const span =
    start === null
      ? null
      : duration !== null && duration > 0
        ? `${clock(start)} – ${clock(start + duration)}`
        : clock(start);

  const submit = () => {
    const parsed = blockFieldsSchema.safeParse({
      title: form.title,
      detail: form.detail,
      category: form.category,
      anchor: form.anchor,
      offsetMinutes: form.offset,
      durationMinutes: form.duration,
      fuel: form.fuel,
      weekdayMask: form.weekdayMask,
      notify: form.notify,
      notifyLeadMinutes: form.notifyLead,
      icon: form.icon,
      enabled: form.enabled,
    });
    if (!parsed.success) {
      setLocalErrors(fieldErrors(parsed.error));
      return;
    }
    setLocalErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form
      className="rounded-lg border border-line-strong bg-surface-2 p-3 sm:p-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Title" htmlFor={`${id}-title`} errors={errors.title}>
          <input
            id={`${id}-title`}
            className={inputClass}
            value={form.title}
            maxLength={80}
            placeholder="Sit, twenty minutes"
            onChange={(event) => set("title", event.target.value)}
          />
        </Field>

        <Field label="Icon" htmlFor={`${id}-icon`} errors={errors.icon}>
          <div className="flex items-center gap-2">
            <BlockIcon name={form.icon} className="size-5 shrink-0 text-text-2" />
            <select
              id={`${id}-icon`}
              className={`${selectClass} sm:w-32`}
              value={form.icon}
              onChange={(event) => set("icon", event.target.value)}
            >
              {BLOCK_ICONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      <Field
        label="Detail"
        htmlFor={`${id}-detail`}
        hint="Optional. The one line you will need reminding of at 4 AM."
        errors={errors.detail}
        className="mt-3"
      >
        <textarea
          id={`${id}-detail`}
          className={inputClass}
          rows={2}
          maxLength={400}
          value={form.detail}
          onChange={(event) => set("detail", event.target.value)}
        />
      </Field>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Category" htmlFor={`${id}-category`} errors={errors.category}>
          <select
            id={`${id}-category`}
            className={selectClass}
            value={form.category}
            onChange={(event) => set("category", event.target.value as BlockCategory)}
          >
            {BLOCK_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_META[category].label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Fuel"
          htmlFor={`${id}-fuel`}
          hint={FUEL_META[form.fuel].blurb}
          errors={errors.fuel}
        >
          <select
            id={`${id}-fuel`}
            className={selectClass}
            value={form.fuel}
            onChange={(event) => set("fuel", event.target.value as BlockFuel)}
          >
            {BLOCK_FUELS.map((fuel) => (
              <option key={fuel} value={fuel}>
                {FUEL_META[fuel].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <Field
          label="Anchor"
          htmlFor={`${id}-anchor`}
          hint={ANCHOR_META[form.anchor].blurb}
          errors={errors.anchor}
        >
          <select
            id={`${id}-anchor`}
            className={selectClass}
            value={form.anchor}
            onChange={(event) => set("anchor", event.target.value as BlockAnchor)}
          >
            {BLOCK_ANCHORS.map((anchor) => (
              <option key={anchor} value={anchor}>
                {ANCHOR_META[anchor].label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={form.anchor === "clock" ? "Minutes from midnight" : "Offset in minutes"}
          htmlFor={`${id}-offset`}
          hint={
            form.anchor === "clock"
              ? "390 is 6:30 AM, and stays 6:30 AM all year."
              : "Negative is before the anchor: −45 is forty-five minutes earlier."
          }
          errors={errors.offsetMinutes}
        >
          <input
            id={`${id}-offset`}
            className={`${inputClass} nums`}
            type="number"
            inputMode="numeric"
            step={1}
            min={form.anchor === "clock" ? 0 : -720}
            max={1440}
            value={form.offset}
            onChange={(event) => set("offset", event.target.value)}
          />
        </Field>

        <Field
          label="Duration"
          htmlFor={`${id}-duration`}
          hint="Minutes. Zero for a moment rather than a stretch."
          errors={errors.durationMinutes}
        >
          <input
            id={`${id}-duration`}
            className={`${inputClass} nums`}
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            max={720}
            value={form.duration}
            onChange={(event) => set("duration", event.target.value)}
          />
        </Field>
      </div>

      <p className="nums mt-2 text-xs text-text-3" aria-live="polite">
        {start === null || span === null ? (
          "Enter a number of minutes to see where this lands."
        ) : (
          <>
            <span className="text-text-2">{describeOffset(form.anchor, offset ?? 0, clock)}</span>
            {" → "}
            <span className="text-text-1">{span}</span> today
          </>
        )}
      </p>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-text-2">Days</legend>
        <p className="mt-0.5 text-xs leading-snug text-text-3">
          {describeMask(form.weekdayMask)}. A block with no days stays on the routine but never
          resolves.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, weekday) => {
            const on = maskHas(form.weekdayMask, weekday);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => set("weekdayMask", maskToggle(form.weekdayMask, weekday))}
                className={`w-11 rounded-md border py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line bg-surface-1 text-text-3 hover:border-line-strong"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MASK_SHORTCUTS.map((shortcut) => (
            <Button
              key={shortcut.label}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set("weekdayMask", shortcut.mask)}
            >
              {shortcut.label}
            </Button>
          ))}
        </div>
        {errors.weekdayMask?.length ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {errors.weekdayMask.join(" ")}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-4 space-y-3 border-t border-line pt-3">
        <CheckboxField
          id={`${id}-notify`}
          label="Remind me"
          hint="Needs the dev server or a deployment running. The .ics export covers the offline case."
          checked={form.notify}
          onChange={(checked) => set("notify", checked)}
        />
        {form.notify ? (
          <Field
            label="Lead time"
            htmlFor={`${id}-lead`}
            hint="Minutes before the block starts."
            errors={errors.notifyLeadMinutes}
            className="sm:max-w-40"
          >
            <input
              id={`${id}-lead`}
              className={`${inputClass} nums`}
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              step={1}
              value={form.notifyLead}
              onChange={(event) => set("notifyLead", event.target.value)}
            />
          </Field>
        ) : null}

        <CheckboxField
          id={`${id}-enabled`}
          label="On the schedule"
          hint="Turning a block off keeps the row and its history; deleting removes both."
          checked={form.enabled}
          onChange={(checked) => set("enabled", checked)}
        />
      </div>

      {errors._?.length ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {errors._.join(" ")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
