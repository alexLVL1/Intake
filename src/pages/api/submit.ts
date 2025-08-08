import type { NextApiRequest, NextApiResponse } from 'next';
import { createServiceClient } from '../../lib/supabase';
import { z } from 'zod';

export const config = {
  api: { bodyParser: false }
};

const fullSchema = z.object({
  personal: z.object({
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
  }),
  immigration: z.object({
    caseType: z.enum(['Family-Based','Removal Defense','Asylum','Employment-Based','U Visa / VAWA','Naturalization','FOIA / Records','Other']),
    entryDate: z.string().optional(),
    mannerOfEntry: z.string().optional(),
    statusHistory: z.string().optional(),
    priorFilings: z.string().optional(),
    criminalHistory: z.string().optional(),
  }),
  documents: z.object({ notes: z.string().optional() }).optional(),
  consent: z.object({
    consent: z.boolean(),
    signature: z.string().min(2),
    dateSigned: z.string().min(1),
  }),
});

function parseFormData(req: NextApiRequest): Promise<{payload:any, files: Array<{buffer:Buffer, filename:string, mimetype:string}>}> {
  const formidable = require('formidable');
  const form = formidable({ multiples: true, maxFiles: 15, maxFileSize: 25*1024*1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err: any, fields: any, files: any) => {
      if (err) return reject(err);
      const payload = JSON.parse(fields.payload);
      const list: Array<{buffer:Buffer, filename:string, mimetype:string}> = [];
      const fs = require('fs');
      const addFile = (f:any) => {
        if (!f) return;
        const buf = fs.readFileSync(f.filepath);
        list.push({buffer:buf, filename:f.originalFilename || f.newFilename, mimetype: f.mimetype || 'application/octet-stream'});
      };
      if (Array.isArray(files.files)) files.files.forEach(addFile);
      else addFile(files.files);
      resolve({ payload, files: list });
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { payload, files } = await parseFormData(req);
    const parsed = fullSchema.parse(payload);
    const svc = createServiceClient();

    // 1) Create intake row
    const submissionId = `LVIL-${Date.now()}`;
    const { data: intakeRow, error: insErr } = await svc.from('intakes').insert({
      submission_id: submissionId,
      personal: parsed.personal,
      immigration: parsed.immigration,
      documents: parsed.documents ?? {},
      consent: parsed.consent,
      created_at: new Date().toISOString(),
      status: 'received'
    }).select('*').single();
    if (insErr) throw insErr;

    // 2) Upload files to storage & log rows
    const uploaded: any[] = [];
    for (const f of files) {
      const path = `${submissionId}/${Date.now()}-${f.filename}`;
      const { data: up, error: upErr } = await svc.storage.from('intake-uploads').upload(path, f.buffer, {
        contentType: f.mimetype, upsert: false
      });
      if (upErr) throw upErr;
      const { data: row, error: rowErr } = await svc.from('intake_files').insert({
        submission_id: submissionId,
        path,
        filename: f.filename,
        mimetype: f.mimetype,
        size: f.buffer.length
      }).select('*').single();
      if (rowErr) throw rowErr;
      uploaded.push(row);
    }

    // 3) Optionally ping Zapier to create Contact + Matter in Clio
    if (process.env.INTAKE_WEBHOOK_URL) {
      await fetch(process.env.INTAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, payload: parsed, files: uploaded })
      }).catch(()=>{});
    }

    return res.status(200).json({ submissionId });
  } catch (e:any) {
    console.error(e);
    return res.status(400).send(e?.message || 'Invalid submission');
  }
}
