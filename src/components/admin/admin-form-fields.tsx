"use client";

import React from "react";

function fieldClassName() {
  return "mt-2 w-full rounded-[16px] border border-[#e6d7c7] bg-[#fffdfa] px-3.5 py-2.5 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]";
}

function labelClassName() {
  return "block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a7143]";
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
        className={`${fieldClassName()} disabled:cursor-not-allowed disabled:bg-[#f8f1e8] disabled:text-[#8a6a49]`}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  step?: number | string;
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
        className={fieldClassName()}
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
        className={`${fieldClassName()} disabled:cursor-not-allowed disabled:bg-[#f8f1e8] disabled:text-[#8a6a49]`}
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
