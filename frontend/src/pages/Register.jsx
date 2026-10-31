import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const emptyForm = {
  name: '', email: '', password: '', phone: '', govtId: '', nationality: '',
  tripStart: '', tripEnd: '', ecName: '', ecPhone: '', ecRelation: '',
};

export default function Register() {
  const { saveSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // One change handler for all inputs, using the input's "name" attribute
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          govtId: form.govtId,
          nationality: form.nationality,
          // The trip runs from the start of the first day to the end of the last day
          tripStart: `${form.tripStart}T00:00:00`,
          tripEnd: `${form.tripEnd}T23:59:59`,
          emergencyContact: { name: form.ecName, phone: form.ecPhone, relation: form.ecRelation },
        },
      });
      saveSession(data);
      navigate('/tourist');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Tourist Registration</h2>
      <form onSubmit={handleSubmit} className="grid">
        <label>Full name<input name="name" value={form.name} onChange={update} required /></label>
        <label>Email<input name="email" type="email" value={form.email} onChange={update} required /></label>
        <label>Password (min 6)<input name="password" type="password" minLength={6} value={form.password} onChange={update} required /></label>
        <label>Phone<input name="phone" value={form.phone} onChange={update} /></label>
        <label>Passport / Aadhaar No.<input name="govtId" value={form.govtId} onChange={update} required /></label>
        <label>Nationality<input name="nationality" value={form.nationality} onChange={update} /></label>
        <label>Trip start<input name="tripStart" type="date" value={form.tripStart} onChange={update} required /></label>
        <label>Trip end<input name="tripEnd" type="date" value={form.tripEnd} onChange={update} required /></label>

        <h3 className="full">Emergency contact</h3>
        <label>Name<input name="ecName" value={form.ecName} onChange={update} required /></label>
        <label>Phone<input name="ecPhone" value={form.ecPhone} onChange={update} required /></label>
        <label>Relation<input name="ecRelation" value={form.ecRelation} onChange={update} /></label>

        {error && <p className="error full">{error}</p>}
        <button className="full" disabled={busy}>{busy ? 'Registering...' : 'Register'}</button>
      </form>
      <p>Already registered? <Link to="/login">Login</Link></p>
    </div>
  );
}
