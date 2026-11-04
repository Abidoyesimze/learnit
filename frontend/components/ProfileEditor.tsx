"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera01Icon, Delete02Icon, Loading03Icon, Tick02Icon } from "hugeicons-react";
import { validateUsername, BIO_MAX, NAME_MAX } from "@learnit/backend/profile";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/useMe";
import { toAvatarBlob } from "@/lib/resizeImage";
import { Avatar } from "./Avatar";

type Check = { state: "idle" | "checking" | "ok" | "bad"; reason?: string };

/** Photo, username, display name and bio. Used on the profile page and in onboarding. */
export function ProfileEditor({ submitLabel = "Save", onDone, allowSkipSave = false }: { submitLabel?: string; onDone?: () => void; allowSkipSave?: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const { data: me } = useMe();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const loaded = useRef(false);
  const file = useRef<HTMLInputElement>(null);

  // Fill the form once, when the profile first arrives.
  useEffect(() => {
    if (!me || loaded.current) return;
    loaded.current = true;
    setUsername(me.username ?? ""); setDisplayName(me.displayName ?? ""); setBio(me.bio ?? "");
  }, [me]);

  // Live username check: format first (instant), then availability (debounced).
  useEffect(() => {
    const u = username.trim();
    if (!u || u.toLowerCase() === (me?.username ?? "")) return setCheck({ state: "idle" });
    const local = validateUsername(u);
    if (!local.ok) return setCheck({ state: "bad", reason: local.reason });
    setCheck({ state: "checking" });
    let dead = false;
    const t = setTimeout(() => {
      api<{ available: boolean; reason?: string }>(`/api/profile/username?u=${encodeURIComponent(local.value)}`)
        .then((r) => { if (!dead) setCheck(r.available ? { state: "ok" } : { state: "bad", reason: r.reason }); })
        .catch(() => { if (!dead) setCheck({ state: "idle" }); });
    }, 450);
    return () => { dead = true; clearTimeout(t); };
  }, [username, me?.username, api]);

  const dirty = !!me && (username.trim().toLowerCase() !== (me.username ?? "") || displayName.trim() !== (me.displayName ?? "") || bio.trim() !== (me.bio ?? ""));
  const blocked = check.state === "bad" || check.state === "checking";

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    setPhotoBusy(true); setErr(null);
    try {
      const blob = await toAvatarBlob(f);
      await api("/api/profile/avatar", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not upload the photo"); }
    finally { setPhotoBusy(false); if (file.current) file.current.value = ""; }
  }

  async function removePhoto() {
    setPhotoBusy(true); setErr(null);
    try { await api("/api/profile/avatar", { method: "DELETE" }); await qc.invalidateQueries({ queryKey: ["me"] }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not remove the photo"); }
    finally { setPhotoBusy(false); }
  }

  async function save() {
    if (!dirty) return onDone?.();
    setSaving(true); setErr(null); setSaved(false);
    try {
      await api("/api/profile", { method: "PUT", body: JSON.stringify({ username, displayName, bio }) });
      await qc.invalidateQueries({ queryKey: ["me"] });
      setSaved(true);
      onDone?.();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
    finally { setSaving(false); }
  }

  const shownName = displayName.trim() || (username ? `@${username}` : "You");
  const field = "mt-2 w-full rounded-input border border-line bg-transparent px-4 py-3 text-base focus:border-ink";
  return (
    <div>
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => file.current?.click()} disabled={photoBusy} aria-label="Change profile photo" className="relative rounded-full transition active:scale-[0.97]">
          <Avatar src={me?.avatarUrl} name={shownName} size={96} />
          <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-paper bg-ink text-paper">
            {photoBusy ? <Loading03Icon className="animate-spin" size={18} strokeWidth={1.75} /> : <Camera01Icon size={18} strokeWidth={1.75} />}
          </span>
        </button>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" tabIndex={-1} onChange={(e) => void pickPhoto(e.target.files?.[0])} />
        <div className="mt-3 flex items-center gap-4 text-sm">
          <button type="button" onClick={() => file.current?.click()} disabled={photoBusy} className="font-medium underline underline-offset-4">{me?.avatarUrl ? "Change photo" : "Add a photo"}</button>
          {me?.avatarUrl && <button type="button" onClick={removePhoto} disabled={photoBusy} className="inline-flex items-center gap-1 text-muted"><Delete02Icon size={16} strokeWidth={1.75} /> Remove</button>}
        </div>
      </div>

      <div className="mt-8 grid gap-5">
        <div>
          <label htmlFor="username" className="text-sm font-medium">Username</label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-4 top-[calc(50%+4px)] -translate-y-1/2 text-muted">@</span>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20} autoComplete="off"
              aria-describedby="username-help" aria-invalid={check.state === "bad"} className={`${field} pl-9`} placeholder="yourname" />
          </div>
          <p id="username-help" className="mt-1.5 min-h-5 text-sm" aria-live="polite">
            {check.state === "checking" && <span className="text-muted">Checking...</span>}
            {check.state === "ok" && <span className="inline-flex items-center gap-1"><Tick02Icon size={16} strokeWidth={2} /> Available</span>}
            {check.state === "bad" && <span className="font-medium">{check.reason}</span>}
            {check.state === "idle" && <span className="text-muted">3 to 20 letters, numbers or underscores.</span>}
          </p>
        </div>
        <div>
          <label htmlFor="display" className="text-sm font-medium">Display name</label>
          <input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={NAME_MAX} autoComplete="name" className={field} placeholder="How you appear to others" />
        </div>
        <div>
          <label htmlFor="bio" className="text-sm font-medium">About you</label>
          <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX} rows={3} className={`${field} resize-none`} placeholder="Why are you learning?" />
          <p className="mt-1 text-right font-mono text-xs text-muted">{bio.length}/{BIO_MAX}</p>
        </div>
      </div>

      {err && <p role="alert" className="mt-4 text-sm font-medium">{err}</p>}
      <button type="button" onClick={save} disabled={saving || !me || blocked || (!dirty && !allowSkipSave)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] transition active:scale-[0.98] disabled:opacity-40">
        {saving && <Loading03Icon className="animate-spin" size={18} strokeWidth={1.75} />}
        {saved && !dirty ? "Saved" : submitLabel}
      </button>
    </div>
  );
}
