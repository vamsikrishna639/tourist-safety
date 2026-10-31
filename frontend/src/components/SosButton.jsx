// Big red SOS button for tourists. Sends the current position; the server ignores repeats within 30 s.
import { useEffect, useState } from 'react';
import { api } from '../api';

const COOLDOWN_MS = 30 * 1000; // same window as the server

export default function SosButton({ position }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Tick every second for the countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function sendSos() {
    setBusy(true);
    setStatus('');
    try {
      const body = { message };
      if (position) {
        body.lat = position[0];
        body.lng = position[1];
      }
      const data = await api('/incidents/sos', { method: 'POST', body });
      if (data.duplicate) {
        setStatus(data.message); // server ignored it: already sent within 30 s
      } else {
        setStatus('SOS sent! The control room has your location.');
        setSentAt(Date.now());
        setMessage('');
      }
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  const secondsLeft = Math.max(0, Math.ceil((sentAt + COOLDOWN_MS - now) / 1000));

  return (
    <div className="card sos-card">
      <h3>Emergency</h3>
      <input
        placeholder="What is happening? (optional)"
        value={message}
        maxLength={300}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button className="sos-button" onClick={sendSos} disabled={busy}>
        {busy ? 'Sending...' : secondsLeft > 0 ? `SOS SENT (${secondsLeft}s)` : 'SOS'}
      </button>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
