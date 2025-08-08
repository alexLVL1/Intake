import React, { useState, useMemo } from 'react';
import { z } from 'zod';

const personalSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  preferredLanguage: z.string().min(1),
  dob: z.string().min(1),
  aNumber: z.string().optional(),
  countryOfBirth: z.string().min(1),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(3),
});

const immigrationSchema = z.object({
  caseType: z.enum(['Family-Based','Removal Defense','Asylum','Employment-Based','U Visa / VAWA','Naturalization','FOIA / Records','Other']),
  entryDate: z.string().optional(),
  mannerOfEntry: z.string().optional(),
  statusHistory: z.string().optional(),
  priorFilings: z.string().optional(),
  criminalHistory: z.string().optional(),
});

const consentSchema = z.object({
  consent: z.boolean().refine(v => v === true, { message: 'Consent required' }),
  signature: z.string().min(2),
  dateSigned: z.string().min(1),
});

const fullSchema = z.object({
  personal: personalSchema,
  immigration: immigrationSchema,
  documents: z.object({
    notes: z.string().optional(),
  }).optional(),
  consent: consentSchema,
});

export default function Home() {
  const empty = useMemo(() => ({
    personal: { firstName:'', lastName:'', email:'', phone:'', preferredLanguage:'English', dob:'', aNumber:'', countryOfBirth:'', addressLine1:'', city:'', state:'', zip:'' },
    immigration: { caseType: 'Family-Based' as const, entryDate:'', mannerOfEntry:'', statusHistory:'', priorFilings:'', criminalHistory:'' },
    documents: { notes: '' },
    consent: { consent:false, signature:'', dateSigned: new Date().toISOString().slice(0,10) }
  }), []);

  const [draft, setDraft] = useState<any>(empty);
  const [step, setStep] = useState(0);
  const steps = ['Personal','Immigration','Documents','Consent','Review'] as const;
  const [errors, setErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submittedId, setSubmittedId] = useState<string|undefined>();

  function validateCurrent() {
    try {
      if (step===0) personalSchema.parse(draft.personal);
      if (step===1) immigrationSchema.parse(draft.immigration);
      if (step===3) consentSchema.parse(draft.consent);
      setErrors([]); return true;
    } catch (e:any) {
      const list = e?.issues?.map((i:any)=> `${i.path.join('.')}: ${i.message}`) ?? ['Please review this step.'];
      setErrors(list); return false;
    }
  }

  async function handleSubmit() {
    try {
      const payload = fullSchema.parse(draft);
      const form = new FormData();
      form.set('payload', JSON.stringify(payload));
      files.slice(0, 15).forEach((f, i) => form.append('files', f, f.name));
      const res = await fetch('/api/submit', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSubmittedId(data.submissionId);
      setDraft(empty); setFiles([]);
    } catch (e:any) {
      setErrors([e.message || 'Submission failed.']);
    }
  }

  const pct = ((step+1)/steps.length)*100;

  return (
    <div className="container">
      <div className="flex">
        <div>
          <h1>Lehigh Valley Immigration Law LLC – Client Intake Portal</h1>
          <div className="muted">Where Immigration Law Meets Humanity</div>
        </div>
        <div className="flex">
          <a href="https://lehighvalleyimmigrationlawyers.cliogrow.com" target="_blank" rel="noreferrer">
            <button className="btn">Book Free Consultation</button>
          </a>
          <button className="btn-outline" onClick={() => {
            const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'lvil-intake-draft.json'; a.click(); URL.revokeObjectURL(url);
          }}>Download Draft</button>
        </div>
      </div>

      <div className="card">
        <div className="flex">
          <div>Step {step+1} of {steps.length}: <span className="pill">{steps[step]}</span></div>
          <div style={{width:160}} className="progress"><div style={{width: pct+'%'}} /></div>
        </div>

        {errors.length>0 && (
          <div className="card" style={{ borderColor:'#fecaca', background:'#fff1f2' }}>
            <div className="error" style={{fontWeight:600}}>Fix the following:</div>
            <ul>{errors.map((e,i)=><li key={i} className="error">{e}</li>)}</ul>
          </div>
        )}

        {step===0 && (
          <div className="row">
            {['firstName','lastName','email','phone','dob','aNumber','countryOfBirth','addressLine1','city','state','zip'].map((k)=>{
              const label = k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
              const type = k==='dob'?'date': (k==='email'?'email':'text');
              return (
                <div key={k}>
                  <label>{label}</label>
                  <input type={type} value={draft.personal[k]||''} onChange={e=>setDraft({...draft, personal:{...draft.personal, [k]: e.target.value}})} />
                </div>
              );
            })}
            <div>
              <label>Preferred Language</label>
              <select value={draft.personal.preferredLanguage} onChange={e=>setDraft({...draft, personal:{...draft.personal, preferredLanguage:e.target.value}})}>
                {['English','Spanish','Haitian Creole','Portuguese','French','Arabic','Mandarin','Other'].map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        {step===1 && (
          <div className="card">
            <div>
              <label>Case Type</label>
              <select value={draft.immigration.caseType} onChange={e=>setDraft({...draft, immigration:{...draft.immigration, caseType:e.target.value}})}>
                {['Family-Based','Removal Defense','Asylum','Employment-Based','U Visa / VAWA','Naturalization','FOIA / Records','Other'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="row-3">
              <div><label>Date of most recent entry</label><input type="date" value={draft.immigration.entryDate||''} onChange={e=>setDraft({...draft, immigration:{...draft.immigration, entryDate:e.target.value}})} /></div>
              <div><label>Manner of entry (e.g., B-2, EWI, Parole)</label><input value={draft.immigration.mannerOfEntry||''} onChange={e=>setDraft({...draft, immigration:{...draft.immigration, mannerOfEntry:e.target.value}})} /></div>
              <div><label>Status history (I-94, extensions, TPS, etc.)</label><input value={draft.immigration.statusHistory||''} onChange={e=>setDraft({...draft, immigration:{...draft.immigration, statusHistory:e.target.value}})} /></div>
            </div>
            <div><label>Prior filings</label><textarea rows={4} value={draft.immigration.priorFilings||''} onChange={e=>setDraft({...draft, immigration:{...draft.immigration, priorFilings:e.target.value}})} /></div>
            <div><label>Arrests/convictions (dates, charges, outcomes)</label><textarea rows={3} value={draft.immigration.criminalHistory||''} onChange={e=>setDraft({...draft, immigration:{...draft.immigration, criminalHistory:e.target.value}})} /></div>
          </div>
        )}

        {step===2 && (
          <div>
            <div><label>Upload documents (PDF/images, max 25MB each, up to 15 files)</label>
              <input type="file" multiple accept="application/pdf,image/*" onChange={e=>{
                const list = Array.from(e.target.files||[]);
                const max = 25*1024*1024;
                const filtered = list.filter(f=>f.size<=max).slice(0,15);
                if (list.some(f=>f.size>max)) setErrors(['One or more files exceeded 25 MB && were skipped.']);
                setFiles(filtered);
              }} />
            </div>
            <div><label>Notes about your documents</label><textarea rows={3} value={draft.documents?.notes||''} onChange={e=>setDraft({...draft, documents:{notes:e.target.value}})} /></div>
          </div>
        )}

        {step===3 && (
          <div className="card">
            <div className="muted">By checking the box below, you agree to provide accurate information && consent to Lehigh Valley Immigration Law LLC to review your submission for the limited purpose of scheduling a consultation && evaluating your case. This submission does not create an attorney–client relationship until a signed engagement agreement && payment are received. Files are limited to PDF && images up to 25 MB each. Unconverted intakes may be deleted after 60 days for privacy.</div>
            <label><input type="checkbox" checked={draft.consent.consent} onChange={e=>setDraft({...draft, consent:{...draft.consent, consent:e.target.checked}})} /> I agree && consent</label>
            <div className="row-3">
              <div><label>Signature (type your full name)</label><input value={draft.consent.signature} onChange={e=>setDraft({...draft, consent:{...draft.consent, signature:e.target.value}})} /></div>
              <div><label>Date</label><input type="date" value={draft.consent.dateSigned} onChange={e=>setDraft({...draft, consent:{...draft.consent, dateSigned:e.target.value}})} /></div>
            </div>
          </div>
        )}

        {step===4 && (
          <div>
            <div className="card"><strong>Personal</strong><pre>{JSON.stringify(draft.personal,null,2)}</pre></div>
            <div className="card"><strong>Immigration</strong><pre>{JSON.stringify(draft.immigration,null,2)}</pre></div>
            <div className="card"><strong>Documents</strong><div>Files: {files.length}</div><pre>{JSON.stringify({notes: draft.documents?.notes},null,2)}</pre></div>
            <div className="card"><strong>Consent</strong><pre>{JSON.stringify(draft.consent,null,2)}</pre></div>
          </div>
        )}

        <div className="flex">
          <button className="btn-outline" onClick={()=>setStep(Math.max(0, step-1))} disabled={step===0}>Back</button>
          <div className="flex">
            {step<steps.length-1 && <button className="btn" onClick={()=>{ if (validateCurrent()) setStep(Math.min(steps.length-1, step+1)); }}>Next</button>}
            {step===steps.length-1 && <button className="btn" onClick={handleSubmit}>Submit</button>}
          </div>
        </div>
      </div>

      {submittedId && (
        <div className="card success">
          Submitted! Confirmation ID: <strong>{submittedId}</strong>.
        </div>
      )}

      <div className="muted" style={{textAlign:'center', marginTop:12}}>
        © {new Date().getFullYear()} Lehigh Valley Immigration Law LLC • Deployed with Vercel + Supabase. Privacy-first. 60-day retention for unconverted intakes.
      </div>
    </div>
  );
}
