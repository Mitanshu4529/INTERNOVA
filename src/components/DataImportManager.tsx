import { useState } from 'react';
import { Upload, Database, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import dataStore from '../data/dataStore';
import { normalizeInternshipRecord, validateInternshipRecord, type NormalizedInternship } from '../utils/dataNormalizer';
import { notify } from '../utils/notify';

interface ImportStats {
  total: number;
  active: number;
  closed: number;
  companies: number;
  sources: { source: string; count: number }[];
}

interface ImportResult {
  success: boolean;
  imported?: number;
  skipped?: number;
  invalid?: number;
  invalidRecords?: any[];
  error?: string;
}

export function DataImportManager() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState('');
  const [removeDupes, setRemoveDupes] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const internships = await dataStore.getInternships();
      const companiesSet = new Set(internships.map(i => i.company));
      const sourceCounts: Record<string, number> = {};

      internships.forEach(i => {
        const s = i.source || 'default';
        sourceCounts[s] = (sourceCounts[s] || 0) + 1;
      });

      setStats({
        total: internships.length,
        active: internships.filter(i => i.status !== 'Closed').length,
        closed: internships.filter(i => i.status === 'Closed').length,
        companies: companiesSet.size,
        sources: Object.entries(sourceCounts).map(([src, count]) => ({ source: src, count }))
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);

      const fileName = selectedFile.name.toLowerCase();
      if (fileName.includes('internshala')) setSource('internshala');
      else if (fileName.includes('naukri')) setSource('naukri');
      else if (fileName.includes('prosple')) setSource('prosple');
      else if (fileName.includes('linkedin')) setSource('linkedin');
      else setSource('csv-import');
    }
  };

  const parseCSVClientSide = (csvText: string): any[] => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    const parseLine = (line: string) => {
      const result = [];
      let start = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
          let field = line.substring(start, i).trim();
          if (field.startsWith('"') && field.endsWith('"')) {
            field = field.substring(1, field.length - 1).replace(/""/g, '"');
          }
          result.push(field);
          start = i + 1;
        }
      }
      let lastField = line.substring(start).trim();
      if (lastField.startsWith('"') && lastField.endsWith('"')) {
        lastField = lastField.substring(1, lastField.length - 1).replace(/""/g, '"');
      }
      result.push(lastField);
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === headers.length) {
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => {
          record[h] = values[idx];
        });
        records.push(record);
      }
    }

    return records;
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const csvText = await file.text();
      const rawRecords = parseCSVClientSide(csvText);

      let importedCount = 0;
      let skippedCount = 0;
      let invalidCount = 0;
      const invalidRecords: any[] = [];
      const normalizedRecords: NormalizedInternship[] = [];

      const existingInternships = await dataStore.getInternships();
      const existingKeys = new Set(existingInternships.map(i => `${i.title.toLowerCase()}_${(i.company || '').toLowerCase()}`));

      const effectiveSource = source.trim() || 'CSV Dataset';

      for (const rec of rawRecords) {
        // Validate required fields
        const validation = validateInternshipRecord(rec);
        if (!validation.valid) {
          invalidCount++;
          invalidRecords.push({ record: rec, errors: validation.errors });
          continue;
        }

        // Normalize the record using the standard normalizer
        const normalized = normalizeInternshipRecord(rec, effectiveSource);
        const key = `${normalized.title.toLowerCase()}_${normalized.company.toLowerCase()}`;

        if (removeDupes && existingKeys.has(key)) {
          skippedCount++;
          continue;
        }

        normalizedRecords.push(normalized);
      }

      // Insert all normalized records
      for (const rec of normalizedRecords) {
        await dataStore.createInternship('admin_import', rec);
        existingKeys.add(`${rec.title.toLowerCase()}_${rec.company.toLowerCase()}`);
        importedCount++;
      }

      setResult({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        invalid: invalidCount,
        invalidRecords
      });

      setResult({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        invalid: 0
      });

      await fetchStats();
    } catch (error) {
      console.error('Import error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Import failed',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear local dataset storage?')) {
      localStorage.removeItem('local_internships');
      notify('Local internship datasets cleared.');
      await fetchStats();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Data Import Manager</h1>
        <p className="text-gray-600">
          Import internship datasets from CSV files directly into the platform index
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 font-semibold text-lg">
            <Database className="size-5" />
            Dataset Index Statistics
          </h2>
          <Button onClick={fetchStats} disabled={loadingStats} variant="outline" size="sm">
            {loadingStats ? <Loader2 className="size-4 animate-spin" /> : 'Refresh Stats'}
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Internships</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-600">{stats.closed}</div>
              <div className="text-sm text-gray-600">Closed</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{stats.companies}</div>
              <div className="text-sm text-gray-600">Companies</div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
          <Upload className="size-5" />
          Import Dataset File
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block mb-2 font-medium text-sm">Select CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && <p className="mt-2 text-sm text-gray-600">Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)</p>}
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm">Source Name</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Internshala, Naukri, Prosple"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remove-dupes"
              checked={removeDupes}
              onChange={(e) => setRemoveDupes(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="remove-dupes" className="text-sm">Remove duplicate entries by title & company</label>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={!file || importing} className="flex-1">
              {importing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Importing Dataset...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  Import Dataset
                </>
              )}
            </Button>

            <Button onClick={handleClearAll} variant="outline" className="text-red-600 hover:bg-red-50">
              Clear Local Data
            </Button>
          </div>
        </div>
      </Card>

      {result && (
        <Alert className={result.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
          <div className="flex items-start gap-3">
            {result.success ? <CheckCircle className="size-5 text-green-600 mt-0.5" /> : <AlertCircle className="size-5 text-red-600 mt-0.5" />}
            <div className="flex-1">
              <AlertDescription>
                {result.success ? (
                  <div>
                    <p className="font-semibold text-green-800">Successfully imported {result.imported} internships!</p>
                    {result.skipped && result.skipped > 0 && <p className="text-sm text-gray-600">Skipped {result.skipped} duplicate record(s).</p>}
                    {result.invalid && result.invalid > 0 && (
                      <div>
                        <p className="text-sm text-amber-600 mt-1">
                          {result.invalid} invalid record(s) skipped (missing required fields).
                        </p>
                        {result.invalidRecords && result.invalidRecords.length > 0 && (
                          <ul className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                            {result.invalidRecords.slice(0, 5).map((invalid, idx) => (
                              <li key={idx} className="text-xs text-amber-700">
                                {invalid.record.title || invalid.record.job_title || '(untitled)'}: {invalid.errors.join('; ')}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="font-semibold text-red-800">Import failed: {result.error}</p>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
}
