"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { signInOwner, verifyOwnerSecondFactor, cancelOwnerSecondFactor } from "../client";
import { Button } from "@/shared/ui/button";

export function LoginExperience({
  returnTo = "/studio/diagram",
}: {
  returnTo?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<"totp" | "backup" | null>(null);
  const [code, setCode] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData(formElement);
      const result = await signInOwner({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });

      if (!result.ok) {
        setError(result.message);
        setSubmitting(false);
        return;
      }

      if (result.secondFactorRequired) {
        formElement.reset();
        setChallenge("totp"); setCode(""); setSubmitting(false);
        return;
      }

      router.replace(returnTo);
      router.refresh();
    } catch {
      setError("Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại.");
      setSubmitting(false);
    }
  };

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!challenge) return;
    setSubmitting(true); setError(null);
    try {
      const result = await verifyOwnerSecondFactor({ code: code.trim(), method: challenge });
      if (!result.ok) { setError(result.message); setCode(""); setSubmitting(false); return; }
      setCode(""); router.replace(returnTo); router.refresh();
    } catch { setError("Chưa xác thực được mã. Hãy kiểm tra kết nối và thử lại."); setSubmitting(false); }
  };

  const cancelChallenge = async () => {
    setSubmitting(true); setError(null);
    try {
      const result = await cancelOwnerSecondFactor();
      if (!result.ok) { setError(result.message); return; }
      setCode(""); setChallenge(null);
    } catch { setError("Chưa huỷ được bước xác thực. Hãy thử lại."); }
    finally { setSubmitting(false); }
  };

  if (challenge) return <main id="main-content" className="login-page"><form className="login-card" action="/studio/login" method="post" onSubmit={verify} aria-busy={submitting}>
    <span className="login-icon"><LockKeyhole size={24} strokeWidth={1.5} aria-hidden="true" /></span>
    <h1>Xác thực hai bước</h1><p>{challenge === "totp" ? "Nhập mã 6 chữ số từ ứng dụng xác thực để hoàn tất đăng nhập." : "Nhập một mã khôi phục chưa sử dụng. Mỗi mã chỉ dùng được một lần."}</p>
    <label htmlFor="login-second-factor">{challenge === "totp" ? "Mã xác thực" : "Mã khôi phục"}</label>
    <input id="login-second-factor" value={code} onChange={(event) => setCode(challenge === "totp" ? event.target.value.replace(/\D/g, "").slice(0, 6) : event.target.value)} autoComplete="one-time-code" inputMode={challenge === "totp" ? "numeric" : "text"} maxLength={challenge === "totp" ? 6 : 100} pattern={challenge === "totp" ? "[0-9]{6}" : undefined} required disabled={submitting} aria-describedby={error ? "login-error" : undefined} autoFocus />
    {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
    <Button type="submit" disabled={submitting}>{submitting ? "Đang xác thực…" : "Xác nhận đăng nhập"}</Button>
    <Button variant="ghost" disabled={submitting} onClick={() => { setChallenge(challenge === "totp" ? "backup" : "totp"); setCode(""); setError(null); }}>{challenge === "totp" ? "Dùng mã khôi phục" : "Dùng ứng dụng xác thực"}</Button>
    <Button variant="ghost" disabled={submitting} onClick={() => void cancelChallenge()}>Quay lại đăng nhập</Button>
  </form></main>;

  return (
    <main id="main-content" className="login-page">
      <form
        className="login-card"
        action="/studio/login"
        method="post"
        onSubmit={submit}
        aria-busy={submitting}
      >
        <span className="login-icon"><LockKeyhole size={24} strokeWidth={1.5} /></span>
        <span className="eyebrow"><i /> BPMN Studio</span>
        <h1>Đăng nhập BPMN Studio</h1>
        <p>Studio chỉ dành cho tài khoản OWNER đã được cấp quyền. Không có đăng ký công khai.</p>
        <label htmlFor="owner-email">Email</label>
        <input
          id="owner-email"
          name="email"
          type="email"
          autoComplete="username"
          aria-describedby={error ? "login-error" : undefined}
          aria-invalid={error ? true : undefined}
          disabled={submitting}
          required
        />
        <label htmlFor="owner-password">Mật khẩu</label>
        <input
          id="owner-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-describedby={error ? "login-error" : undefined}
          aria-invalid={error ? true : undefined}
          disabled={submitting}
          required
        />
        {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
        <small>Phiên đăng nhập được xác thực phía máy chủ. Liên hệ quản trị viên nếu tài khoản chưa được cấp quyền.</small>
      </form>
    </main>
  );
}
