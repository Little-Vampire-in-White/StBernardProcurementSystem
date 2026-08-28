import { useEffect, useState } from "react";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { useApi } from "../../lib/api";

const DOC_TYPES = [
  'PR','Canvass','BAC_Resolution','PO','AIR','OR','Invoice','DeliveryReceipt','Checklist','Certification','BudgetAllocation','Other'
];

export default function DocumentUploadModal({ requestId, open, onClose, onUploaded }: { requestId: number | string | null, open: boolean, onClose: ()=>void, onUploaded?: ()=>void }){
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const apiFetch = useApi();

  async function loadDocuments() {
    if (!requestId) return setDocuments([]);
    try {
      const res = await apiFetch(`/api/documents/list/${requestId}`);
      const j = await res.json();
      if (res.ok && j.documents) setDocuments(j.documents);
      else setDocuments([]);
    } catch (err) {
      console.warn(err);
      setDocuments([]);
    }
  }

  useEffect(()=>{ if(!open){ setFile(null); setMessage(null); setDocType(DOC_TYPES[0]); } },[open]);
  useEffect(()=>{ if(open) loadDocuments(); },[open, requestId]);

  async function handleUpload(e: React.FormEvent){
    e.preventDefault();
    if(!requestId) return setMessage('Missing request id');
    if(!file) return setMessage('Please choose a file');
    setLoading(true); setMessage(null);
    try{
      const fd = new FormData();
      fd.append('file', file as Blob);
      fd.append('request_id', String(requestId));
      fd.append('doc_type', docType);

      const res = await apiFetch('/api/documents/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'upload failed');
      setMessage('Uploaded');
      setFile(null);
      await loadDocuments();
      if (onUploaded) onUploaded();
    }catch(err:any){
      setMessage(err.message || 'Upload error');
    }finally{ setLoading(false); }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={`Documents for ${requestId}`}>
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Uploaded documents</div>
            <div className="text-sm text-gray-500">{documents.length}/12</div>
          </div>
          <div className="mt-2 max-h-40 overflow-auto border rounded-md p-2 bg-white">
            {documents.length === 0 && <div className="text-sm text-gray-500">No documents uploaded yet.</div>}
            {documents.map((d:any)=> (
              <div key={d.id} className="flex items-center justify-between text-sm py-1">
                <div>
                  <div className="font-medium">{d.doc_type}</div>
                  <div className="text-xs text-gray-500">{d.uploaded_by || '—'} • {d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : ''}</div>
                </div>
                <div>
                  {d.file_path ? <a className="text-blue-600" href={`/${d.file_path}`} target="_blank" rel="noreferrer">View</a> : <span className="text-gray-500">No file</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Document type</label>
          <select value={docType} onChange={e=>setDocType(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300">
            {DOC_TYPES.map(dt=> <option key={dt} value={dt}>{dt}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">File</label>
          <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} className="mt-1" />
        </div>

        {message && <div className="text-sm text-gray-600">{message}</div>}

        <div className="flex gap-2 justify-end">
          <Button type="button" onClick={onClose} className="bg-gray-200">Close</Button>
          <Button type="submit" disabled={loading} className="bg-brand-500">{loading ? 'Uploading...' : 'Upload'}</Button>
        </div>
      </form>
    </Modal>
  );
}
