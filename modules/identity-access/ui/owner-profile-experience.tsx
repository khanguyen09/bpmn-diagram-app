"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Monitor, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ModalDialog } from "@/shared/ui/modal-dialog";
import {
  getOwnerProfile, updateOwnerProfile, changeOwnerPassword, revokeOwnerSession,
  enableOwnerTwoFactor, verifyOwnerTwoFactor, disableOwnerTwoFactor,
  regenerateOwnerBackupCodes, signOutOwner, type OwnerProfile,
} from "../client";
import "./owner-profile.css";

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Không có thông tin" : new Intl.DateTimeFormat("vi", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
export function sessionDeviceLabel(userAgent: string | null | undefined) {
  const agent = userAgent ?? "";
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\//.test(agent) ? "Opera" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Trình duyệt";
  const system = /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Windows/.test(agent) ? "Windows" : /Macintosh|Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return system ? `${browser} · ${system}` : browser === "Trình duyệt" ? "Thiết bị không xác định" : browser;
}
function Feedback({ error, message }: { error: string | null; message?: string | null }) {
  return error ? <p className="owner-profile__error" role="alert">{error}</p> : message ? <p className="owner-profile__success" role="status">{message}</p> : null;
}

export function OwnerProfileExperience() {
  const router = useRouter();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let current = true;
    void getOwnerProfile(page).then((result) => {
      if (!current) return;
      if (result.ok) {
        const lastPage = Math.max(1, result.data.sessions.totalPages);
        if (page > lastPage) { setPage(lastPage); return; }
        setProfile(result.data);
      } else setError(result.message);
      setLoading(false);
    }).catch(() => { if (current) { setError("Chưa tải được tài khoản. Hãy kiểm tra kết nối và thử lại."); setLoading(false); } });
    return () => { current = false; };
  }, [page, revision]);
  const refresh = () => { setLoading(true); setError(null); setRevision((value) => value + 1); };
  const changePage = (nextPage: number) => { setLoading(true); setError(null); setPage(nextPage); };
  const logout = async () => {
    setSigningOut(true); setError(null);
    try { await signOutOwner(); router.replace("/studio/login"); router.refresh(); }
    catch { setError("Chưa đăng xuất được. Hãy thử lại."); setSigningOut(false); }
  };
  return <div className="studio-page owner-profile">
    <header className="studio-titlebar owner-profile__header"><div><span className="mono-label">Không gian biên tập</span><h1>Tài khoản</h1><p>Quản lý hồ sơ, bảo mật và thiết bị đang đăng nhập.</p></div><Button variant="secondary" onClick={() => void logout()} disabled={signingOut}>{signingOut ? "Đang đăng xuất…" : "Đăng xuất"}</Button></header>
    <Feedback error={error} />
    {error && <Button variant="secondary" onClick={refresh}>Tải lại tài khoản</Button>}
    {!profile ? loading && <p role="status">Đang tải tài khoản…</p> : !error && <div className="owner-profile__layout">
      <nav className="owner-profile__nav" aria-label="Cài đặt tài khoản"><a href="#account">Tài khoản</a><a href="#security">Mật khẩu</a><a href="#two-factor">Xác thực hai bước</a><a href="#sessions">Phiên đăng nhập</a></nav>
      <div className="owner-profile__panels">
        <AccountPanel user={profile.user} onSaved={refresh} />
        <PasswordPanel email={profile.user.email} onSaved={refresh} />
        <TwoFactorPanel email={profile.user.email} enabled={profile.user.twoFactorEnabled} onSaved={refresh} />
        <SessionsPanel sessions={profile.sessions} loading={loading} onPage={changePage} onSaved={refresh} />
      </div>
    </div>}
  </div>;
}

function AccountPanel({ user, onSaved }: { user: OwnerProfile["user"]; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState(user.image ?? "");
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      const result = await updateOwnerProfile({ name: name.trim(), image: image.trim() || null });
      if (!result.ok) setError(result.message); else { setMessage("Đã cập nhật hồ sơ."); onSaved(); }
    } catch { setError("Chưa lưu được hồ sơ. Hãy thử lại."); } finally { setBusy(false); }
  };
  return <section id="account" className="owner-profile__panel" aria-labelledby="account-title"><div className="owner-profile__panel-title"><UserRound size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="account-title">Tài khoản</h2><Badge tone="neutral">Chủ sở hữu</Badge></div>
    <div className="owner-profile__identity">
      {user.image && failedImage !== user.image ?
        // eslint-disable-next-line @next/next/no-img-element
        <img className="owner-profile__avatar" src={user.image} alt="Ảnh đại diện" referrerPolicy="no-referrer" onError={() => setFailedImage(user.image)} /> : <span className="owner-profile__avatar" aria-hidden="true">{user.name.trim().slice(0, 1).toLocaleUpperCase("vi") || "O"}</span>}
      <div><strong>{user.name}</strong><p>{user.email}</p></div>
    </div>
    <form onSubmit={submit} aria-busy={busy}><label htmlFor="profile-name">Tên hiển thị<input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} required disabled={busy} /></label>
      <label htmlFor="profile-image">Đường dẫn ảnh đại diện <span>(tuỳ chọn)</span><input id="profile-image" type="url" value={image} onChange={(event) => setImage(event.target.value)} maxLength={2048} placeholder="https://…" disabled={busy} aria-describedby="profile-image-help" /></label>
      <p id="profile-image-help" className="owner-profile__hint">Dùng đường dẫn ảnh HTTPS. Để trống để dùng chữ cái đầu tên; chưa hỗ trợ tải tệp ảnh.</p>
      <Feedback error={error} message={message} /><Button type="submit" disabled={busy || !name.trim()}>{busy ? "Đang lưu…" : "Lưu hồ sơ"}</Button>
    </form><p className="owner-profile__hint">Email đăng nhập hiện chưa thể thay đổi vì dịch vụ gửi email xác minh chưa được cấu hình.</p>
  </section>;
}

function PasswordPanel({ email, onSaved }: { email: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    setError(null); setMessage(null);
    if (values.get("newPassword") !== values.get("confirmation")) { setError("Hai lần nhập mật khẩu mới chưa trùng nhau."); return; }
    setBusy(true);
    try {
      const result = await changeOwnerPassword({ currentPassword: String(values.get("currentPassword")), newPassword: String(values.get("newPassword")) });
      if (!result.ok) setError(result.message); else { form.reset(); setMessage("Đã đổi mật khẩu và đăng xuất các phiên khác."); onSaved(); }
    } catch { setError("Chưa đổi được mật khẩu. Hãy thử lại."); } finally { setBusy(false); }
  };
  return <section id="security" className="owner-profile__panel" aria-labelledby="password-title"><div className="owner-profile__panel-title"><KeyRound size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="password-title">Mật khẩu</h2></div><p>Đổi mật khẩu sẽ đăng xuất các thiết bị khác. Phiên hiện tại được giữ lại.</p>
    <form onSubmit={submit} aria-busy={busy}>
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <label htmlFor="current-password">Mật khẩu hiện tại<input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required disabled={busy} maxLength={128} /></label>
      <label htmlFor="new-password">Mật khẩu mới<input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} /></label>
      <label htmlFor="confirm-password">Nhập lại mật khẩu mới<input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} /></label>
      <p className="owner-profile__hint">Dùng từ 12 đến 128 ký tự. Chưa có chức năng khôi phục mật khẩu qua email.</p><Feedback error={error} message={message} /><Button type="submit" disabled={busy}>{busy ? "Đang đổi…" : "Đổi mật khẩu"}</Button>
    </form></section>;
}

function TwoFactorPanel({ email, enabled, onSaved }: { email: string; enabled: boolean; onSaved: () => void }) {
  const [action, setAction] = useState<"enable" | "disable" | "backup" | null>(null);
  const [enrollment, setEnrollment] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codesSaved, setCodesSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const close = () => { if (busy) return; setAction(null); setEnrollment(null); setRecovery(null); setPassword(""); setCode(""); setCodesSaved(false); setError(null); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      if (enrollment) {
        if (!codesSaved) { setError("Hãy lưu mã khôi phục trước khi bật xác thực hai bước."); return; }
        const result = await verifyOwnerTwoFactor(code);
        if (!result.ok) setError(result.message); else { setRecovery(enrollment.backupCodes); setEnrollment(null); setCode(""); setMessage("Đã bật xác thực hai bước."); onSaved(); }
      } else if (action === "enable") {
        const result = await enableOwnerTwoFactor(password);
        if (!result.ok) setError(result.message); else { setEnrollment(result.data); setPassword(""); }
      } else if (action === "disable") {
        const result = await disableOwnerTwoFactor(password);
        if (!result.ok) setError(result.message); else { setAction(null); setPassword(""); setMessage("Đã tắt xác thực hai bước."); onSaved(); }
      } else if (action === "backup") {
        const result = await regenerateOwnerBackupCodes(password);
        if (!result.ok) setError(result.message); else { setRecovery(result.data.backupCodes); setPassword(""); }
      }
    } catch { setError("Chưa hoàn tất thao tác bảo mật. Hãy kiểm tra kết nối và thử lại."); } finally { setBusy(false); }
  };
  return <section id="two-factor" className="owner-profile__panel" aria-labelledby="two-factor-title"><div className="owner-profile__panel-title"><ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="two-factor-title">Xác thực hai bước</h2><Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Đã bật" : "Chưa bật"}</Badge></div>
    <p>Dùng mã từ ứng dụng xác thực để bảo vệ tài khoản. Không cần nhận mã qua email hoặc SMS.</p><Feedback error={null} message={message} />
    <div className="owner-profile__actions">{enabled ? <><Button variant="secondary" onClick={() => setAction("backup")}>Tạo lại mã khôi phục</Button><Button variant="ghost" onClick={() => setAction("disable")}>Tắt xác thực hai bước</Button></> : <Button onClick={() => setAction("enable")}>Thiết lập xác thực hai bước</Button>}</div>
    <ModalDialog open={action !== null} onRequestClose={close} closeOnEscape={!busy} className="owner-profile__dialog" aria-labelledby="two-factor-dialog-title">
      <h2 id="two-factor-dialog-title">{recovery ? "Lưu mã khôi phục" : enrollment ? "Kết nối ứng dụng xác thực" : action === "disable" ? "Tắt xác thực hai bước" : action === "backup" ? "Tạo lại mã khôi phục" : "Thiết lập xác thực hai bước"}</h2>
      {recovery ? <><p>Lưu các mã này ở nơi riêng tư. Mỗi mã chỉ dùng một lần; các mã cũ đã được thay thế. Sau khi đóng, trang sẽ không giữ bản sao.</p><ul className="owner-profile__recovery">{recovery.map((value) => <li key={value}><code>{value}</code></li>)}</ul><Button onClick={close}>Tôi đã lưu mã</Button></> : <form onSubmit={submit} aria-busy={busy}>
        {!enrollment && <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />}
        {enrollment ? <><TotpSetup uri={enrollment.totpURI} /><p>Lưu mã khôi phục dưới đây để dùng khi không còn ứng dụng xác thực. Mỗi mã dùng một lần.</p><ul className="owner-profile__recovery">{enrollment.backupCodes.map((value) => <li key={value}><code>{value}</code></li>)}</ul><label className="owner-profile__checkbox"><input type="checkbox" checked={codesSaved} onChange={(event) => setCodesSaved(event.target.checked)} required disabled={busy} />Tôi đã lưu mã khôi phục ở nơi riêng tư.</label><label htmlFor="setup-code">Mã xác thực 6 chữ số<input id="setup-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required disabled={busy} /></label></> : <><p>{action === "disable" ? "Sau khi tắt, tài khoản chỉ còn được bảo vệ bằng mật khẩu." : action === "backup" ? "Mã mới sẽ thay thế toàn bộ mã khôi phục cũ." : "Xác nhận mật khẩu trước khi kết nối ứng dụng xác thực."}</p><label htmlFor="security-password">Mật khẩu hiện tại<input id="security-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required maxLength={128} disabled={busy} /></label></>}
        <Feedback error={error} /><div className="owner-profile__actions"><Button type="submit" disabled={busy}>{busy ? "Đang xử lý…" : enrollment ? "Xác nhận và bật" : "Tiếp tục"}</Button><Button variant="ghost" onClick={close} disabled={busy}>Huỷ</Button></div>
      </form>}
    </ModalDialog>
  </section>;
}

function TotpSetup({ uri }: { uri: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void import("qrcode").then((module) => module.toDataURL(uri, { width: 224, margin: 2 })).then((value) => { if (active) setQr(value); }).catch(() => { if (active) setQr(null); });
    return () => { active = false; };
  }, [uri]);
  let secret = "";
  try { const parsed = new URL(uri); if (parsed.protocol === "otpauth:") secret = parsed.searchParams.get("secret") ?? ""; } catch { /* Do not render malformed setup data. */ }
  return <div><p>Quét mã QR bằng ứng dụng xác thực hoặc nhập khoá thiết lập bên dưới. Không chia sẻ mã QR hay khoá này.</p>{qr &&
    // eslint-disable-next-line @next/next/no-img-element
    <img className="owner-profile__qr" src={qr} width={224} height={224} alt="Mã QR thiết lập ứng dụng xác thực" />}
    <code className="owner-profile__setup-key">{secret || "Chưa nhận được khoá thiết lập hợp lệ. Hãy đóng và thử lại."}</code></div>;
}

function SessionsPanel({ sessions, loading, onPage, onSaved }: { sessions: OwnerProfile["sessions"]; loading: boolean; onPage: (page: number) => void; onSaved: () => void }) {
  const [target, setTarget] = useState<string | "others" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const revoke = async () => {
    if (!target) return; setBusy(true); setError(null); setMessage(null);
    try { const result = await revokeOwnerSession(target === "others" ? { others: true } : { sessionId: target }); if (!result.ok) setError(result.message); else { setTarget(null); setMessage("Đã đăng xuất phiên được chọn."); onSaved(); } }
    catch { setError("Chưa đăng xuất được phiên. Hãy thử lại."); } finally { setBusy(false); }
  };
  return <section id="sessions" className="owner-profile__panel" aria-labelledby="sessions-title"><div className="owner-profile__panel-title"><Monitor size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="sessions-title">Phiên đăng nhập</h2></div><p>Kiểm tra thiết bị đang truy cập tài khoản của bạn.</p>
    <Feedback error={null} message={message} />{loading ? <p role="status">Đang cập nhật phiên đăng nhập…</p> : <>
      {sessions.items.length === 0 ? <p>Không có phiên đăng nhập trong trang này.</p> : <ul className="owner-profile__sessions">{sessions.items.map((session) => <li key={session.id}><div><strong>{sessionDeviceLabel(session.userAgent)}</strong>{session.current && <Badge tone="success">Phiên hiện tại</Badge>}<p>Đăng nhập: {date(session.createdAt)} · Hết hạn: {date(session.expiresAt)}</p>{session.ipAddress && <small>Địa chỉ IP: {session.ipAddress}</small>}</div>{!session.current && <Button variant="secondary" onClick={() => { setError(null); setTarget(session.id); }}>Đăng xuất phiên</Button>}</li>)}</ul>}
      <div className="owner-profile__actions"><Button variant="secondary" disabled={sessions.total <= 1} onClick={() => { setError(null); setTarget("others"); }}>Đăng xuất các phiên khác</Button><Button variant="ghost" onClick={onSaved}>Làm mới</Button></div>
      {sessions.totalPages > 1 && <nav className="owner-profile__pagination" aria-label="Phân trang phiên đăng nhập"><Button variant="secondary" disabled={sessions.page <= 1} onClick={() => onPage(sessions.page - 1)}>Trang trước</Button><span>Trang {sessions.page} / {sessions.totalPages}</span><Button variant="secondary" disabled={sessions.page >= sessions.totalPages} onClick={() => onPage(sessions.page + 1)}>Trang sau</Button></nav>}
    </>}
    <ModalDialog open={target !== null} onRequestClose={() => { if (!busy) setTarget(null); }} closeOnEscape={!busy} className="owner-profile__dialog" aria-labelledby="revoke-title"><h2 id="revoke-title">Đăng xuất {target === "others" ? "các phiên khác" : "phiên đã chọn"}?</h2><p>Thiết bị đó sẽ cần đăng nhập lại. Phiên hiện tại của bạn được giữ lại.</p><Feedback error={error} /><div className="owner-profile__actions"><Button onClick={() => void revoke()} disabled={busy}>{busy ? "Đang đăng xuất…" : "Xác nhận đăng xuất"}</Button><Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>Huỷ</Button></div></ModalDialog>
  </section>;
}
