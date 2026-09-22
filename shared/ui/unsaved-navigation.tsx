"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/shared/ui/button";
import { ModalDialog } from "@/shared/ui/modal-dialog";
import {
  hasUnsavedNavigationSentinel,
  reduceUnsavedNavigation,
  shouldConfirmAnchorNavigation,
  withoutUnsavedNavigationSentinel,
  withUnsavedNavigationSentinel,
  type UnsavedNavigationEffect,
  type UnsavedNavigationEvent,
  type UnsavedNavigationPhase,
} from "./unsaved-navigation-policy";

type PendingConfirmation =
  | { readonly kind: "back" }
  | { readonly kind: "link"; readonly href: string };

type UnsavedNavigationGuard = {
  readonly confirmationDialog: ReactNode;
  readonly release: () => Promise<void>;
};

export function useUnsavedNavigationGuard({
  active,
  subject = "thay đổi",
}: {
  readonly active: boolean;
  readonly subject?: string;
}): UnsavedNavigationGuard {
  const router = useRouter();
  const phaseRef = useRef<UnsavedNavigationPhase>("idle");
  const activeRef = useRef(active);
  const allowedRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const pendingHrefRef = useRef<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const releaseResolversRef = useRef<Array<() => void>>([]);
  const dispatchRef = useRef<(event: UnsavedNavigationEvent) => void>(() => undefined);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  const settleRelease = useCallback(() => {
    const resolvers = releaseResolversRef.current.splice(0);
    for (const resolve of resolvers) resolve();
  }, []);

  const settleReleaseAfterPopState = useCallback(() => {
    // Let every popstate listener (including Next.js' router) finish restoring
    // the previous history entry before a caller starts its own navigation.
    // Resolving synchronously here lets that router restoration cancel the
    // caller's immediately-following router.replace/router.push.
    window.setTimeout(settleRelease, 0);
  }, [settleRelease]);

  const neutralizeCurrentEntry = useCallback(() => {
    const token = tokenRef.current;
    if (!token || !hasUnsavedNavigationSentinel(window.history.state, token)) return;
    window.history.replaceState(
      withoutUnsavedNavigationSentinel(window.history.state),
      "",
      window.location.href,
    );
  }, []);

  const navigate = useCallback((href: string) => {
    const target = new URL(href, window.location.href);
    if (target.origin === window.location.origin) {
      router.push(`${target.pathname}${target.search}${target.hash}`);
      return;
    }
    window.location.assign(target.href);
  }, [router]);

  const runEffects = useCallback((effects: readonly UnsavedNavigationEffect[]) => {
    for (const effect of effects) {
      if (effect === "PUSH_SENTINEL") {
        const token = crypto.randomUUID();
        tokenRef.current = token;
        window.history.pushState(
          withUnsavedNavigationSentinel(window.history.state, token),
          "",
          window.location.href,
        );
      } else if (effect === "RESTORE_SENTINEL") {
        window.history.forward();
      } else if (effect === "OPEN_LINK_DIALOG") {
        const href = pendingHrefRef.current;
        if (href) setConfirmation({ kind: "link", href });
      } else if (effect === "OPEN_BACK_DIALOG") {
        setConfirmation({ kind: "back" });
      } else if (effect === "CLOSE_DIALOG") {
        setConfirmation(null);
      } else if (effect === "NEUTRALIZE_AND_BACK") {
        neutralizeCurrentEntry();
        window.history.back();
      } else if (effect === "NEUTRALIZE_AND_GO_BACK_TWO") {
        neutralizeCurrentEntry();
        window.history.go(-2);
      } else if (effect === "NAVIGATE_LINK") {
        const href = pendingHrefRef.current;
        pendingHrefRef.current = null;
        if (href) navigate(href);
      } else if (effect === "NEUTRALIZE") {
        neutralizeCurrentEntry();
      }
    }
  }, [navigate, neutralizeCurrentEntry]);

  const dispatch = useCallback((event: UnsavedNavigationEvent) => {
    const previous = phaseRef.current;
    const transition = reduceUnsavedNavigation(previous, event);
    phaseRef.current = transition.phase;
    runEffects(transition.effects);
    if (transition.phase === "idle") {
      if (previous === "cleaning") {
        settleReleaseAfterPopState();
      } else {
        settleRelease();
      }
      if (activeRef.current && !allowedRef.current && previous === "cleaning") {
        window.queueMicrotask(() => dispatchRef.current({ type: "ACTIVATE" }));
      }
    }
  }, [runEffects, settleRelease, settleReleaseAfterPopState]);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    activeRef.current = active;
    if (active && !allowedRef.current) {
      dispatch({ type: "ACTIVATE" });
    } else if (!active) {
      allowedRef.current = false;
      dispatch({ type: "DEACTIVATE" });
    }
  }, [active, dispatch]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeRef.current || allowedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!activeRef.current || allowedRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (!shouldConfirmAnchorNavigation({
        href: anchor.href,
        currentHref: window.location.href,
        button: event.button,
        defaultPrevented: event.defaultPrevented,
        download: anchor.hasAttribute("download"),
        target: anchor.target,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      })) return;

      event.preventDefault();
      pendingHrefRef.current = anchor.href;
      openerRef.current = anchor;
      dispatchRef.current({ type: "LINK" });
    };

    const handlePopState = () => {
      openerRef.current = document.activeElement as HTMLElement | null;
      dispatchRef.current({ type: "BACK" });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
      dispatchRef.current({ type: "UNMOUNT" });
      settleRelease();
    };
  }, [settleRelease]);

  const cancel = () => {
    dispatchRef.current({ type: "CANCEL" });
    window.setTimeout(() => openerRef.current?.focus(), 0);
  };

  const confirm = () => {
    allowedRef.current = true;
    dispatchRef.current({ type: "CONFIRM" });
  };

  const release = useCallback(() => {
    allowedRef.current = true;
    if (phaseRef.current === "idle") return Promise.resolve();
    return new Promise<void>((resolve) => {
      releaseResolversRef.current.push(resolve);
      dispatchRef.current({ type: "RELEASE" });
    });
  }, []);

  return {
    release,
    confirmationDialog: confirmation ? (
      <ModalDialog
        open
        className="unsaved-navigation-dialog"
        aria-labelledby="unsaved-navigation-title"
        aria-describedby="unsaved-navigation-description"
        onRequestClose={cancel}
      >
        <section>
          <header>
            <AlertTriangle size={20} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <span className="mono-label">Chưa lưu xong</span>
              <h2 id="unsaved-navigation-title">Rời trang và bỏ {subject}?</h2>
            </div>
          </header>
          <p id="unsaved-navigation-description">
            Nội dung chưa được máy chủ xác nhận có thể bị mất. Bạn có thể ở lại để lưu xong trước.
          </p>
          <footer>
            <Button data-dialog-initial-focus variant="secondary" onClick={cancel}>
              Ở lại
            </Button>
            <Button onClick={confirm}>Rời trang</Button>
          </footer>
        </section>
      </ModalDialog>
    ) : null,
  };
}
