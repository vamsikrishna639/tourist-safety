// Tourist's Digital ID: QR code (contains only the hash) and its live blockchain status.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useSocketEvent } from '../SocketContext';
import CheckList from './CheckList';

export default function DigitalIdCard() {
  const [data, setData] = useState(null); // { idHash, idTxHash, qr, result }
  const [error, setError] = useState('');
  const [showChecks, setShowChecks] = useState(false);

  const load = useCallback(() => {
    api('/verify/my-id')
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  // If an officer revokes this ID, the server tells us and we refresh the status
  useSocketEvent('alert', (alert) => {
    if (alert.kind === 'ID_REVOKED') load();
  });

  return (
    <div className="card">
      <h3>My Digital ID</h3>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <span className={`badge ${data.result.valid ? 'badge-ok' : 'badge-bad'}`}>{data.result.verdict}</span>
          <div className="qr-box">
            <img src={data.qr} alt="Digital ID QR code" width={200} height={200} />
          </div>
          <a href={data.qr} download="digital-id-qr.png" className="hint">Download QR image</a>
          <p className="mono">{data.idHash}</p>
          {data.idTxHash && <p className="hint">Registered in transaction <span className="mono">{data.idTxHash.slice(0, 20)}...</span></p>}
          <button className="btn-outline btn-small" onClick={() => setShowChecks(!showChecks)}>
            {showChecks ? 'Hide checks' : 'Show checks'}
          </button>
          {showChecks && <CheckList result={data.result} />}
        </>
      )}
    </div>
  );
}
