import { useRef, useState, useSyncExternalStore } from "react";
import { gameSaveCommands, gameSaveStore } from "../features/persistence";

export function SaveAccountPanel(): JSX.Element {
  const snapshot = useSyncExternalStore(gameSaveStore.subscribe, gameSaveStore.getSnapshot, gameSaveStore.getSnapshot);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportSave = () => {
    const blob = new Blob([gameSaveCommands.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bai-xiaochun-save.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSave = async (file: File | undefined) => {
    if (!file) return;
    const result = await gameSaveCommands.importJson(await file.text());
    setMessage(result.ok ? "存檔已匯入並保存。" : result.error ?? "匯入失敗。" );
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const displayName = typeof snapshot.user?.user_metadata?.full_name === "string"
    ? snapshot.user.user_metadata.full_name
    : snapshot.user?.email;

  return (
    <section className="save-account" aria-label="雲端存檔">
      <div>
        <span>雲端存檔</span>
        <strong>{snapshot.user ? `已登入：${displayName ?? "Google 使用者"}` : snapshot.configured ? "尚未登入" : "尚未設定 Supabase"}</strong>
      </div>
      <div className="save-account__actions">
        {snapshot.user ? (
          <button type="button" onClick={() => void gameSaveCommands.signOut()}>登出</button>
        ) : (
          <button type="button" disabled={!snapshot.configured} onClick={() => void gameSaveCommands.signInWithGoogle()}>使用 Google 登入</button>
        )}
        <button type="button" disabled={!snapshot.cloudReady} onClick={exportSave}>匯出 JSON</button>
        <button type="button" disabled={!snapshot.cloudReady} onClick={() => { if (window.confirm("匯入將覆蓋目前雲端進度。建議先匯出備份，確定要繼續嗎？")) importInputRef.current?.click(); }}>匯入 JSON</button>
        <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={event => void importSave(event.target.files?.[0])} />
      </div>
      <small>{snapshot.loading ? "正在讀取雲端存檔…" : snapshot.saving ? "正在保存雲端存檔…" : snapshot.cloudReady ? "只使用雲端存檔；無法讀取雲端時不會改用本機進度。" : "請登入 Google 並連接雲端存檔。"}</small>
      {(message ?? snapshot.error) && <small className="save-account__error">{message ?? snapshot.error}</small>}
    </section>
  );
}
