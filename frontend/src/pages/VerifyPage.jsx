// Admin/Police: scan (or paste) a tourist's Digital ID and check it against MongoDB + the blockchain.
import { useEffect, useState } from 'react';
import QrScanner from '../components/QrScanner';
import CheckList from '../components/CheckList';
import { api } from '../api';
import { formatDate } from '../utils';

export default function VerifyPage() {
  const [input, setInput] = useState('');
  const [idHash, setIdHash] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [chain, setChain] = useState(null);

  // Show whether the blockchain is reachable
  useEffect(() => {
    api('/verify/chain')
      .then(setChain)
      .catch((err) => setChain({ ok: false, error: err.message }));
  }, []);

  async function verify(text) {
    const hash = text.trim().replace(/^TSID:/i, ''); // our QR codes start with "TSID:"
    setIdHash(hash);
    setInput(hash);
    setError('');
    setResult(null);
    setBusy(true);
    try {
      setResult(await api(`/verify/id/${encodeURIComponent(hash)}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!window.confirm(`Revoke the Digital ID of ${result.tourist.name}? This is recorded on the blockchain and cannot be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      setResult(await api(`/verify/id/${idHash}/revoke`, { method: 'POST' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const canRevoke = result?.tourist && !['REVOKED', 'NOT ON BLOCKCHAIN'].includes(result.verdict);
  const t = result?.tourist;

  return (
    <div className="dashboard">
      <div>
        <div className="card">
          <h3>Scan Digital ID</h3>
          <p className="hint">
            {chain === null ? 'Checking blockchain...'
              : chain.ok ? `Blockchain connected: contract ${chain.address.slice(0, 10)}..., block ${chain.blockNumber}`
              : chain.error}
          </p>
          <QrScanner onScan={verify} />
          <form
            className="row"
            style={{ marginTop: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              verify(input);
            }}
          >
            <input style={{ flex: 1 }} placeholder="...or paste the ID hash (0x...)" value={input} onChange={(e) => setInput(e.target.value)} />
            <button disabled={busy || !input.trim()}>Verify</button>
          </form>
        </div>
      </div>

      <div className="side">
        <div className="card">
          <h3>Result</h3>
          {busy && <p className="hint">Checking...</p>}
          {error && <p className="error">{error}</p>}
          {!result && !busy && !error && <p className="hint">Scan a QR code or paste an ID to verify it.</p>}
          {result && <CheckList result={result} />}
          {t && (
            <table className="details">
              <tbody>
                <tr><th>Name</th><td>{t.name}</td></tr>
                <tr><th>Nationality</th><td>{t.nationality || '-'}</td></tr>
                <tr><th>Phone</th><td>{t.phone || '-'}</td></tr>
                <tr><th>Trip</th><td>{formatDate(t.tripStart)} to {formatDate(t.tripEnd)}</td></tr>
                <tr><th>Emergency</th><td>{t.emergencyContact?.name}, {t.emergencyContact?.phone}</td></tr>
              </tbody>
            </table>
          )}
          {canRevoke && (
            <button className="btn-danger" style={{ marginTop: 12 }} onClick={revoke} disabled={busy}>Revoke this ID</button>
          )}
        </div>
      </div>
    </div>
  );
}
