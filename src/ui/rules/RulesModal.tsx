import { useEffect, useMemo, useState } from "react";
import { buildGameRules } from "../../features/rules";

/** In-game rule reference: one tab per table, built from the live balance data. */
export function RulesModal({ onClose }: { readonly onClose: () => void }): JSX.Element {
  const tables = useMemo(() => buildGameRules(), []);
  const [activeId, setActiveId] = useState(tables[0].id);
  const table = tables.find(candidate => candidate.id === activeId) ?? tables[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-modal-title" onClick={onClose}>
      <section className="rules-modal__sheet" onClick={event => event.stopPropagation()}>
        <header className="rules-modal__header">
          <h2 id="rules-modal-title">遊戲規則</h2>
          <button type="button" className="rules-modal__close" aria-label="關閉" onClick={onClose}>✕</button>
        </header>
        <nav className="rules-modal__tabs" role="tablist" aria-label="規則分類">
          {tables.map(candidate => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={candidate.id === table.id}
              className={candidate.id === table.id ? "rules-modal__tab is-active" : "rules-modal__tab"}
              onClick={() => setActiveId(candidate.id)}
            >
              {candidate.title}
            </button>
          ))}
        </nav>
        <div className="rules-modal__body" role="tabpanel" aria-label={table.title}>
          <div className="rules-modal__scroll">
            <table className="rules-table">
              <thead>
                <tr>{table.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map(row => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => index === 0 ? <th key={index} scope="row">{cell}</th> : <td key={index}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.notes && <ul className="rules-modal__notes">{table.notes.map(note => <li key={note}>{note}</li>)}</ul>}
        </div>
      </section>
    </div>
  );
}
