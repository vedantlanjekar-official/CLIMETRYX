"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Option } from "@/lib/questionnaire/types";

export function Combobox({
  id,
  options,
  value,
  onChange,
  invalid,
  describedBy,
  placeholder = "Type to search",
}: {
  id: string;
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? null;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const term = (query ?? "").trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term) || option.help?.toLowerCase().includes(term));
  }, [options, query]);

  function choose(option: Option) {
    onChange(option.value);
    setQuery(null);
    setOpen(false);
  }

  return (
    <div className="ax-combo">
      <input
        id={id}
        className="ax-control"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={placeholder}
        value={query ?? selected?.label ?? ""}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            setOpen(false);
            setQuery(null);
          }, 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
          if (!event.target.value) onChange(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(filtered.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === "Enter" && open && filtered[active]) {
            event.preventDefault();
            choose(filtered[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setQuery(null);
          }
        }}
      />
      {open ? (
        <ul id={listId} role="listbox" className="ax-listbox">
          {filtered.length === 0 ? <li className="ax-option" role="option" aria-selected={false} aria-disabled="true">No match</li> : null}
          {filtered.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-active={index === active}
              className="ax-option"
              onMouseDown={(event) => {
                event.preventDefault();
                if (blurTimer.current) clearTimeout(blurTimer.current);
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
            >
              {option.label}
              {option.help ? <small>{option.help}</small> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
