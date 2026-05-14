import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus, Users, Search, Loader2, ChevronRight, ChevronDown, ChevronUp,
  FileSpreadsheet, Trash2, FolderPlus, Eye, Check, X, AlertTriangle,
  Target, Save, Upload, Database, ArrowLeft, ArrowRight, Settings,
} from 'lucide-react'
import api from '../api/api'
import { fmtNum, fmtDate } from '../utils/formatters'

const ROLES = ['Lead Gen Executive', 'Team Lead', 'Admin']

function useSettingsPersons() {
  return useQuery({
    queryKey: ['settings-persons'],
    queryFn: () => api.get('/api/settings/persons').then(r => r.data),
    staleTime: 30000,
  })
}

function useTargets() {
  return useQuery({
    queryKey: ['daily-targets'],
    queryFn: () => api.get('/api/daily-activity/targets').then(r => r.data),
    staleTime: 60000,
  })
}

// ─── Add Person Wizard ───────────────────────────────────────────

function AddPersonWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(1)
  const queryClient = useQueryClient()

  const [personForm, setPersonForm] = useState({ full_name: '', short_name: '', email: '', role: 'Lead Gen Executive' })
  const [fileTab, setFileTab] = useState('auto')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [manualFileId, setManualFileId] = useState('')
  const [manualFileType, setManualFileType] = useState('CURRENT')
  const [scannedFiles, setScannedFiles] = useState([])
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [importResult, setImportResult] = useState(null)

  const handleSearchDrive = async () => {
    setSearching(true)
    try {
      const { data } = await api.post('/api/settings/search-drive', { name: personForm.full_name })
      setSearchResults(data.files || [])
    } catch (e) {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const toggleFileSelection = (file) => {
    setSelectedFiles(prev => {
      const exists = prev.find(f => f.drive_file_id === file.drive_file_id)
      if (exists) return prev.filter(f => f.drive_file_id !== file.drive_file_id)
      return [...prev, { ...file, file_type: 'CURRENT' }]
    })
  }

  const updateFileType = (driveId, type) => {
    setSelectedFiles(prev => prev.map(f => f.drive_file_id === driveId ? { ...f, file_type: type } : f))
  }

  const handleAddManualFile = () => {
    if (!manualFileId.trim()) return
    let fileId = manualFileId.trim()
    const match = fileId.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match) fileId = match[1]
    if (selectedFiles.find(f => f.drive_file_id === fileId)) return
    setSelectedFiles(prev => [...prev, {
      drive_file_id: fileId,
      name: `File: ${fileId.substring(0, 20)}...`,
      file_type: manualFileType,
    }])
    setManualFileId('')
  }

  const handleScanFiles = async () => {
    setScanning(true)
    const results = []
    for (const file of selectedFiles) {
      try {
        const { data } = await api.post('/api/settings/scan-file', {
          drive_file_id: file.drive_file_id,
          file_type: file.file_type,
        })
        results.push({ ...data, file_type: file.file_type })
      } catch (e) {
        results.push({
          file_name: file.name,
          drive_file_id: file.drive_file_id,
          file_type: file.file_type,
          worksheets: [],
          error: e.response?.data?.detail || 'Failed to scan',
        })
      }
    }
    setScannedFiles(results)
    setScanning(false)
    setStep(3)
  }

  const handleImport = async () => {
    setImporting(true)
    setStep(4)

    const files = scannedFiles.map(sf => ({
      drive_file_id: sf.drive_file_id,
      file_name: sf.file_name,
      file_type: sf.file_type,
      worksheets_approved: sf.worksheets
        .filter(ws => ws.mapped_table !== 'SKIP' && !ws.is_empty)
        .map(ws => ({
          name: ws.name,
          mapped_table: ws.mapped_table,
          store_as_jsonb: ws.mapped_table === 'UNKNOWN',
        })),
    }))

    setImportProgress({ status: 'importing', percent: 30 })

    try {
      const { data } = await api.post('/api/settings/add-person', {
        ...personForm,
        files,
      })
      setImportProgress({ status: 'complete', percent: 100 })
      setImportResult(data)
      setStep(5)
      queryClient.invalidateQueries({ queryKey: ['settings-persons'] })
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    } catch (e) {
      setImportProgress({ status: 'error', percent: 0, error: e.response?.data?.detail || 'Import failed' })
    } finally {
      setImporting(false)
    }
  }

  const updateWorksheetMapping = (fileIdx, wsIdx, newTable) => {
    setScannedFiles(prev => {
      const updated = [...prev]
      const file = { ...updated[fileIdx] }
      const worksheets = [...file.worksheets]
      worksheets[wsIdx] = { ...worksheets[wsIdx], mapped_table: newTable }
      file.worksheets = worksheets
      updated[fileIdx] = file
      return updated
    })
  }

  const renderStep1 = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-content">Step 1: Person Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-muted mb-1">Person's Full Name *</label>
          <input
            type="text" value={personForm.full_name}
            onChange={e => setPersonForm(p => ({ ...p, full_name: e.target.value }))}
            placeholder="e.g. Umair Raizan"
            className="w-full px-3 py-2.5 bg-surface border border-edge rounded-lg text-sm text-content placeholder:text-content-faint focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-muted mb-1">Display Name / Nickname</label>
          <input
            type="text" value={personForm.short_name}
            onChange={e => setPersonForm(p => ({ ...p, short_name: e.target.value }))}
            placeholder="e.g. Umair"
            className="w-full px-3 py-2.5 bg-surface border border-edge rounded-lg text-sm text-content placeholder:text-content-faint focus:outline-none focus:border-blue-500/50"
          />
          <p className="text-xs text-content-faint mt-1">Shown in charts, cards & filters. Full Name appears in tables & details.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-content-muted mb-1">Email</label>
          <input
            type="email" value={personForm.email}
            onChange={e => setPersonForm(p => ({ ...p, email: e.target.value }))}
            placeholder="priya@company.com"
            className="w-full px-3 py-2.5 bg-surface border border-edge rounded-lg text-sm text-content placeholder:text-content-faint focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-muted mb-1">Role</label>
          <select
            value={personForm.role}
            onChange={e => setPersonForm(p => ({ ...p, role: e.target.value }))}
            className="w-full px-3 py-2.5 bg-surface border border-edge rounded-lg text-sm text-content focus:outline-none focus:border-blue-500/50"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => setStep(2)}
          disabled={!personForm.full_name.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
        >
          Next: Find Google Sheets <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-content">Step 2: Find Google Sheets for {personForm.full_name}</h3>

      <div className="flex gap-2 border-b border-edge">
        <button
          onClick={() => setFileTab('auto')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${fileTab === 'auto' ? 'border-blue-500 text-blue-400' : 'border-transparent text-content-muted hover:text-content'}`}
        >
          Auto-Detect (Recommended)
        </button>
        <button
          onClick={() => setFileTab('manual')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${fileTab === 'manual' ? 'border-blue-500 text-blue-400' : 'border-transparent text-content-muted hover:text-content'}`}
        >
          Manual Add
        </button>
      </div>

      {fileTab === 'auto' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={handleSearchDrive}
              disabled={searching}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium hover:bg-blue-500/20 disabled:opacity-40 transition-colors"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search Google Drive for "{personForm.full_name}"
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-content-muted">Found {searchResults.length} files:</p>
              {searchResults.map(file => {
                const isSelected = selectedFiles.find(f => f.drive_file_id === file.drive_file_id)
                return (
                  <div
                    key={file.drive_file_id}
                    className={`p-4 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-surface border-edge hover:border-edge/80'}`}
                    onClick={() => toggleFileSelection(file)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-edge'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-content truncate">{file.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-content-faint">
                          <span>ID: {file.drive_file_id.substring(0, 12)}...</span>
                          {file.modified_time && <span>Modified: {fmtDate(file.modified_time)}</span>}
                        </div>
                        {isSelected && (
                          <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <span className="text-xs text-content-muted">Type:</span>
                            <select
                              value={selectedFiles.find(f => f.drive_file_id === file.drive_file_id)?.file_type || 'CURRENT'}
                              onChange={e => updateFileType(file.drive_file_id, e.target.value)}
                              className="px-2 py-1 bg-surface-card border border-edge rounded text-xs text-content"
                            >
                              <option value="CURRENT">CURRENT</option>
                              <option value="PAST">PAST</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <FileSpreadsheet className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-content-muted mb-1">Google Drive File ID or URL</label>
              <input
                type="text" value={manualFileId}
                onChange={e => setManualFileId(e.target.value)}
                placeholder="Paste file ID or full Google Sheets URL"
                className="w-full px-3 py-2.5 bg-surface border border-edge rounded-lg text-sm text-content placeholder:text-content-faint focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <select
              value={manualFileType}
              onChange={e => setManualFileType(e.target.value)}
              className="px-3 py-2.5 bg-surface border border-edge rounded-lg text-sm text-content"
            >
              <option value="CURRENT">CURRENT</option>
              <option value="PAST">PAST</option>
            </select>
            <button onClick={handleAddManualFile} className="px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium hover:bg-blue-500/20">
              Add
            </button>
          </div>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="bg-surface-card border border-edge rounded-xl p-4">
          <p className="text-sm font-medium text-content mb-2">{selectedFiles.length} file(s) selected</p>
          {selectedFiles.map(f => (
            <div key={f.drive_file_id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-content-muted truncate">{f.name}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${f.file_type === 'CURRENT' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{f.file_type}</span>
                <button onClick={() => setSelectedFiles(prev => prev.filter(x => x.drive_file_id !== f.drive_file_id))} className="p-1 hover:bg-surface-hover rounded">
                  <X className="w-3 h-3 text-content-faint" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2.5 text-content-muted hover:text-content text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleScanFiles}
          disabled={selectedFiles.length === 0 || scanning}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Scan Selected Files
        </button>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-content">Step 3: Preview Worksheets & Columns</h3>

      {scannedFiles.map((sf, fileIdx) => (
        <div key={sf.drive_file_id} className="bg-surface-card border border-edge rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-content">{sf.file_name}</p>
              <p className="text-xs text-content-faint">
                Type: <span className={sf.file_type === 'CURRENT' ? 'text-emerald-400' : 'text-amber-400'}>{sf.file_type}</span>
                {' '}| {sf.total_rows || 0} total rows | {sf.total_worksheets || sf.worksheets?.length || 0} worksheets
              </p>
            </div>
          </div>

          {sf.error ? (
            <div className="px-4 py-3 text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {sf.error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-content-muted border-b border-edge">
                    <th className="text-left py-2 px-4 font-medium">Worksheet</th>
                    <th className="text-right py-2 px-4 font-medium">Rows</th>
                    <th className="text-left py-2 px-4 font-medium">Columns Found</th>
                    <th className="text-left py-2 px-4 font-medium">Maps To</th>
                  </tr>
                </thead>
                <tbody>
                  {sf.worksheets?.map((ws, wsIdx) => (
                    <tr key={ws.name} className="border-b border-edge/30 hover:bg-surface-hover">
                      <td className="py-2 px-4 text-content font-medium">{ws.name}</td>
                      <td className="py-2 px-4 text-right text-content-muted">
                        {ws.is_empty ? <span className="text-content-faint">(empty)</span> : fmtNum(ws.rows)}
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(ws.columns || []).slice(0, 5).map((col, i) => (
                            <span key={i} className="text-xs bg-surface px-1.5 py-0.5 rounded text-content-muted">{col}</span>
                          ))}
                          {(ws.columns || []).length > 5 && (
                            <span className="text-xs text-content-faint">+{ws.columns.length - 5} more</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        {ws.is_empty ? (
                          <span className="text-xs text-content-faint">SKIP</span>
                        ) : (
                          <select
                            value={ws.mapped_table || 'UNKNOWN'}
                            onChange={e => updateWorksheetMapping(fileIdx, wsIdx, e.target.value)}
                            className={`text-xs px-2 py-1 rounded border ${
                              ws.mapped_table === 'UNKNOWN' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                              ws.mapped_table === 'SKIP' ? 'bg-surface border-edge text-content-faint' :
                              'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            }`}
                          >
                            <option value="target_tracking">target_tracking</option>
                            <option value="linkedin_connections">linkedin_connections</option>
                            <option value="linkedin_followups">linkedin_followups</option>
                            <option value="linkedin_inmails">linkedin_inmails</option>
                            <option value="emails">emails</option>
                            <option value="data_extraction">data_extraction</option>
                            <option value="positive_responses">positive_responses</option>
                            <option value="leads_generated">leads_generated</option>
                            <option value="UNKNOWN">UNKNOWN (store as JSONB)</option>
                            <option value="SKIP">SKIP</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-between">
        <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2.5 text-content-muted hover:text-content text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleImport}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
        >
          <Upload className="w-4 h-4" /> Approve & Import
        </button>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-content">Step 4: Importing {personForm.full_name}'s Data...</h3>
      <div className="bg-surface-card border border-edge rounded-xl p-6">
        <div className="w-full bg-surface rounded-full h-3 mb-4 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-1000 ${importProgress?.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${importProgress?.percent || 0}%` }}
          />
        </div>
        {importProgress?.status === 'importing' && (
          <div className="flex items-center gap-3 text-sm text-content-muted">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span>Importing data... This may take a minute.</span>
          </div>
        )}
        {importProgress?.status === 'error' && (
          <div className="flex items-center gap-3 text-sm text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{importProgress.error}</span>
          </div>
        )}
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-5">
      <div className="bg-surface-card border border-emerald-500/20 rounded-xl p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-content mb-2">{personForm.full_name} added successfully!</h3>
        <div className="inline-block bg-surface border border-edge rounded-xl p-4 mt-4 text-left">
          <table className="text-sm">
            <tbody>
              <tr><td className="py-1 pr-6 text-content-muted">Files imported</td><td className="py-1 font-semibold text-content">{importResult?.files_imported || 0}</td></tr>
              <tr><td className="py-1 pr-6 text-content-muted">Total rows</td><td className="py-1 font-semibold text-content">{fmtNum(importResult?.total_rows || 0)}</td></tr>
              {importResult?.import_results?.map((fr, i) => (
                <tr key={i}>
                  <td className="py-1 pr-6 text-content-muted">{fr.file_name}</td>
                  <td className="py-1 font-semibold text-content">{fmtNum(fr.total_imported)} rows</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-center gap-3">
        <button onClick={onComplete} className="px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          Go to Dashboard
        </button>
        <button onClick={onClose} className="px-4 py-2.5 bg-surface border border-edge text-content rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
          Add Another Person
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-surface-card border border-edge rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              s < step ? 'bg-emerald-500 text-white' :
              s === step ? 'bg-blue-500 text-white' :
              'bg-surface border border-edge text-content-faint'
            }`}>
              {s < step ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 5 && <div className={`w-8 h-0.5 ${s < step ? 'bg-emerald-500' : 'bg-edge'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
    </div>
  )
}


// ─── Team Members Table ──────────────────────────────────────────

function TeamMembersTable({ onAddFile }) {
  const { data: persons, isLoading } = useSettingsPersons()
  const [expandedPerson, setExpandedPerson] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const queryClient = useQueryClient()

  const handleDelete = async (personId) => {
    try {
      await api.delete(`/api/settings/person/${personId}`)
      queryClient.invalidateQueries({ queryKey: ['settings-persons'] })
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setConfirmDelete(null)
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  const { data: personFiles } = useQuery({
    queryKey: ['person-files', expandedPerson],
    queryFn: () => api.get(`/api/settings/person/${expandedPerson}/files`).then(r => r.data),
    enabled: !!expandedPerson,
    staleTime: 30000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (!persons?.length) {
    return (
      <div className="text-center py-10 text-content-muted text-sm">
        No team members found. Add your first person above.
      </div>
    )
  }

  return (
    <div className="bg-surface-card border border-edge rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-edge">
            <th className="text-left py-3 px-4 font-semibold text-content-muted">#</th>
            <th className="text-left py-3 px-4 font-semibold text-content-muted">Name</th>
            <th className="text-left py-3 px-4 font-semibold text-content-muted">Files</th>
            <th className="text-right py-3 px-4 font-semibold text-content-muted">Total Rows</th>
            <th className="text-left py-3 px-4 font-semibold text-content-muted">Current File</th>
            <th className="text-left py-3 px-4 font-semibold text-content-muted">Last Synced</th>
            <th className="text-center py-3 px-4 font-semibold text-content-muted">Actions</th>
          </tr>
        </thead>
        <tbody>
          {persons.map((p, idx) => (
            <>
              <tr key={p.id} className="border-b border-edge/30 hover:bg-surface-hover transition-colors">
                <td className="py-3 px-4 text-content-faint">{idx + 1}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <div>
                      <span className="font-medium text-content">{p.full_name}</span>
                      <span className="text-xs text-content-faint ml-2">{p.role}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-content-muted">
                  {p.files_count} ({p.past_files} past, {p.current_files} current)
                </td>
                <td className="py-3 px-4 text-right font-medium text-content">{fmtNum(p.total_rows)}</td>
                <td className="py-3 px-4 text-content-muted text-xs truncate max-w-[200px]">{p.current_file || '-'}</td>
                <td className="py-3 px-4 text-content-faint text-xs">{p.last_synced ? fmtDate(p.last_synced) : '-'}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setExpandedPerson(expandedPerson === p.id ? null : p.id)}
                      className="p-1.5 hover:bg-surface rounded-lg text-content-muted hover:text-content transition-colors"
                      title="View Files"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onAddFile(p.id)}
                      className="p-1.5 hover:bg-surface rounded-lg text-content-muted hover:text-blue-400 transition-colors"
                      title="Add File"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(p.id)}
                      className="p-1.5 hover:bg-surface rounded-lg text-content-muted hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              {expandedPerson === p.id && (
                <tr key={`exp-${p.id}`}>
                  <td colSpan={7} className="px-4 py-3 bg-surface">
                    {personFiles?.files?.length ? (
                      <div className="space-y-2">
                        {personFiles.files.map(f => (
                          <div key={f.id} className="bg-surface-card border border-edge rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-medium text-content">{f.file_name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${f.file_type === 'CURRENT' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{f.file_type}</span>
                              </div>
                              <span className="text-xs text-content-faint">{f.ingested_at ? fmtDate(f.ingested_at) : ''}</span>
                            </div>
                            {f.worksheets?.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {f.worksheets.map((ws, i) => (
                                  <span key={i} className="text-xs bg-surface px-2 py-1 rounded text-content-muted">
                                    {ws.name} ({ws.rows_imported} rows)
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-content-faint py-2">Loading files...</p>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {confirmDelete && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface-card border border-edge rounded-xl p-6 w-96 shadow-2xl">
            <h4 className="text-lg font-bold text-content mb-2">Confirm Removal</h4>
            <p className="text-sm text-content-muted mb-4">
              Are you sure? This will delete <strong>all data</strong> for {persons.find(p => p.id === confirmDelete)?.full_name} from all tables. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-content-muted hover:text-content">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


// ─── Targets Config ──────────────────────────────────────────────

function TargetsConfig() {
  const { data: targets, isLoading } = useTargets()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const fields = [
    { key: 'target_connections', label: 'Connections / day', default: 100 },
    { key: 'target_followups', label: 'Follow Ups / day', default: 100 },
    { key: 'target_inmails', label: 'InMails / day', default: 30 },
    { key: 'target_emails', label: 'Emails / day', default: 10 },
    { key: 'target_data_extraction', label: 'Data Extraction / day', default: 0 },
    { key: 'target_positive_responses', label: 'Positive Responses / day', default: 2 },
    { key: 'target_leads', label: 'Leads / day', default: 1 },
  ]

  const current = form || targets || {}

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/api/daily-activity/targets', form || targets)
      queryClient.invalidateQueries({ queryKey: ['daily-targets'] })
      queryClient.invalidateQueries({ queryKey: ['daily-activity'] })
      setForm(null)
    } catch (e) {
      console.error('Save targets failed:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-card border border-edge rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-content flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400" /> Daily Targets
        </h3>
        {form && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Targets
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-20"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-content-muted mb-1">{f.label}</label>
              <input
                type="number"
                value={current[f.key] ?? f.default}
                onChange={e => setForm(prev => ({ ...(prev || targets || {}), [f.key]: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-content focus:outline-none focus:border-blue-500/50"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ─── Main Settings Page ──────────────────────────────────────────

export default function SettingsPage() {
  const [showAddWizard, setShowAddWizard] = useState(false)
  const [activeTab, setActiveTab] = useState('team')

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-edge pb-1">
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'team' ? 'border-blue-500 text-blue-400' : 'border-transparent text-content-muted hover:text-content'
          }`}
        >
          <Users className="w-4 h-4" /> Manage Team Members
        </button>
        <button
          onClick={() => setActiveTab('targets')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'targets' ? 'border-blue-500 text-blue-400' : 'border-transparent text-content-muted hover:text-content'
          }`}
        >
          <Target className="w-4 h-4" /> Daily Targets
        </button>
      </div>

      {activeTab === 'team' && (
        <div className="space-y-6">
          {showAddWizard ? (
            <AddPersonWizard
              onClose={() => setShowAddWizard(false)}
              onComplete={() => setShowAddWizard(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddWizard(true)}
              className="flex items-center gap-2 px-5 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              <UserPlus className="w-5 h-5" /> Add New Person
            </button>
          )}

          <div>
            <h3 className="text-lg font-bold text-content mb-4">Existing Team Members</h3>
            <TeamMembersTable onAddFile={(personId) => {}} />
          </div>
        </div>
      )}

      {activeTab === 'targets' && <TargetsConfig />}
    </div>
  )
}
