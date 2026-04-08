"use client";

import React from "react";

function fieldClassName() {
  return "mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] shadow-sm outline-none transition focus:border-[var(--portal-accent)] focus:ring-4 focus:ring-[rgba(90,142,245,0.14)]";
}

function labelClassName() {
  return "block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]";
}

export function AdminTextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
}) {
  return (
    <label className={labelClassName()}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`${fieldClassName()} disabled:cursor-not-allowed disabled:bg-[var(--portal-surface-muted)] disabled:text-[var(--portal-text-muted)]`}
      />
    </label>
  );
}

export function AdminNumberInput({
  label,
  value,
  onChange,
  placeholder,
  min,
  step,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  step?: number | string;
  disabled?: boolean;
}) {
  return (
    <label className={labelClassName()}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        step={step}
        disabled={disabled}
        className={`${fieldClassName()} disabled:cursor-not-allowed disabled:bg-[var(--portal-surface-muted)] disabled:text-[var(--portal-text-muted)]`}
      />
    </label>
  );
}

export function AdminDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={labelClassName()}>
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName()}
      />
    </label>
  );
}

export function AdminSelectInput({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className={labelClassName()}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${fieldClassName()} disabled:cursor-not-allowed disabled:bg-[var(--portal-surface-muted)] disabled:text-[var(--portal-text-muted)]`}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || "empty"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminTextAreaInput({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className={labelClassName()}>
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={fieldClassName()}
      />
    </label>
  );
}
