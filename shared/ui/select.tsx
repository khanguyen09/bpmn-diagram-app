"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";

export type SelectOption = {
  readonly value: string;
  readonly label: string;
};

export function Select({
  id,
  value,
  options,
  onValueChange,
  className,
  labelledBy,
  describedBy,
  disabled = false,
}: {
  readonly id: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onValueChange: (value: string) => void;
  readonly className?: string;
  readonly labelledBy: string;
  readonly describedBy?: string;
  readonly disabled?: boolean;
}) {
  const generatedId = useId();
  const listboxId = `${id}-${generatedId.replaceAll(":", "")}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const focusedOpeningRef = useRef(false);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });

  const selected = options[selectedIndex];
  const activeOptionId = `${listboxId}-option-${activeIndex}`;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const up = below < 220 && above > below;
      const height = Math.min(280, Math.max(44, up ? above : below));
      setPosition({ position: "fixed", inset: "auto", left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(rect.width, window.innerWidth - 16) - 8)), width: Math.min(rect.width, window.innerWidth - 16), maxHeight: height, ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      focusedOpeningRef.current = false;
      return;
    }
    // Focus only after the visible positioning has reached the DOM. A frame
    // scheduled beside setPosition can run before that state update commits.
    if (position.visibility === "hidden" || focusedOpeningRef.current) return;
    listboxRef.current?.focus({ preventScroll: true });
    focusedOpeningRef.current = true;
  }, [open, position]);

  useEffect(() => {
    const list = listboxRef.current;
    const option = list?.querySelector<HTMLElement>(`[id="${activeOptionId}"]`);
    if (!open || !list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [open, activeOptionId]);

  useEffect(
    () => () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    },
    [],
  );

  const openListbox = (index = selectedIndex) => {
    if (disabled || !options.length) return;
    setActiveIndex(index);
    setOpen(true);
  };

  const closeListbox = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectIndex = (index: number) => {
    const option = options[index];
    if (!option) return;
    onValueChange(option.value);
    setActiveIndex(index);
    closeListbox(true);
  };

  const moveActive = (direction: 1 | -1) => {
    setActiveIndex((current) =>
      (current + direction + options.length) % options.length,
    );
  };

  const runTypeahead = (key: string) => {
    typeaheadRef.current += key.toLocaleLowerCase("vi");
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => {
      typeaheadRef.current = "";
    }, 700);
    const query = typeaheadRef.current;
    const match = options.findIndex((option) =>
      option.label.toLocaleLowerCase("vi").startsWith(query),
    );
    if (match >= 0) {
      setActiveIndex(match);
      if (!open) openListbox(match);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key.length === 1 && /\S/.test(event.key)) {
      event.preventDefault();
      runTypeahead(event.key);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openListbox();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) selectIndex(activeIndex);
      else openListbox();
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      closeListbox(true);
      return;
    }
    if (event.key === "Tab" && open) {
      requestAnimationFrame(() => setOpen(false));
    }
  };

  return (
    <div ref={rootRef} className={cn("select", className)}>
      <button
        ref={triggerRef}
        id={id}
        className="select__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? closeListbox() : openListbox())}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={listboxRef}
          id={listboxId}
          className="select__listbox"
          style={position}
          role="listbox"
          tabIndex={0}
          aria-labelledby={labelledBy}
          aria-activedescendant={activeOptionId}
          onKeyDown={handleKeyDown}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              id={`${listboxId}-option-${index}`}
              className={cn("select__option", index === activeIndex && "is-active")}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => selectIndex(index)}
            >
              <span>{option.label}</span>
              {option.value === value ? (
                <Check size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
