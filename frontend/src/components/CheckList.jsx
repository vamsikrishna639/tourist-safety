// Shows a verification result: a big verdict plus a tick/cross for every individual check.
// Used for Digital ID verification and for the incident integrity check.
export default function CheckList({ result }) {
  const good = result.valid ?? result.intact;
  return (
    <div>
      <div className={`verdict ${good ? 'verdict-ok' : 'verdict-bad'}`}>{result.verdict}</div>
      {result.error && <p className="error">{result.error}</p>}
      <ul className="checks">
        {result.checks.map((c) => (
          <li key={c.label} className={c.ok ? 'check-ok' : 'check-bad'}>
            <span className="check-icon">{c.ok ? '✔' : '✘'}</span>
            <div>
              {c.label}
              {c.detail && <div className="check-detail">{c.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
