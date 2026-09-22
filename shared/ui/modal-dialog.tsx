"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentPropsWithoutRef,
} from "react";
import { cn } from "@/shared/lib/cn";

type ModalDialogProps = Omit<ComponentPropsWithoutRef<"dialog">, "open"> & {
  readonly open: boolean;
  readonly onRequestClose: () => void;
  readonly closeOnEscape?: boolean;
};

export const ModalDialog = forwardRef<HTMLDialogElement, ModalDialogProps>(
  function ModalDialog(
    {
      open,
      onRequestClose,
      closeOnEscape = true,
      className,
      children,
      onKeyDown,
      ...props
    },
    forwardedRef,
  ) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(forwardedRef, () => dialogRef.current!, []);

    useEffect(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (open && !dialog.open) {
        const activeElement = document.activeElement;
        openerRef.current =
          activeElement instanceof HTMLElement &&
          activeElement !== document.body &&
          activeElement !== document.documentElement
            ? activeElement
            : null;
        dialog.showModal();
        window.requestAnimationFrame(() => {
          const initialFocus = dialog.querySelector<HTMLElement>(
            "[data-dialog-initial-focus]",
          );
          initialFocus?.focus();
        });
      } else if (!open && dialog.open) {
        dialog.close();
      }

      return () => {
        const opener = openerRef.current;
        window.setTimeout(() => {
          if (opener?.isConnected) opener.focus();
        }, 0);
      };
    }, [open]);

    return (
      <dialog
        {...props}
        ref={dialogRef}
        className={cn("modal-dialog", className)}
        onCancel={(event) => {
          event.preventDefault();
          if (closeOnEscape) onRequestClose();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Tab") return;
          const dialog = dialogRef.current;
          if (!dialog) return;
          const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
          )).filter((element) => element.getClientRects().length > 0);
          if (focusable.length === 0) return;
          const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
          const nextIndex = event.shiftKey
            ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
            : (currentIndex < 0 || currentIndex === focusable.length - 1
              ? 0
              : currentIndex + 1);
          event.preventDefault();
          focusable[nextIndex]?.focus();
        }}
      >
        {children}
      </dialog>
    );
  },
);
