import { useState } from 'react';
import { Upload, Database, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

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

  const API_BASE_URL = `https://${import.meta.env.VITE_SUPABASE_URL}.supabase.co/functions/v1/make-server-cb26aef8`;

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch(`${API_BASE_URL}/internships/stats`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileExtension === 'csv' || fileExtension === 'xlsx' || fileExtension === 'xls') {
        setFile(selectedFile);
        setResult(null);
        
        // Try to detect source from filename
        const fileName = selectedFile.name.toLowerCase();
        if (fileName.includes('internshala')) setSource('internshala');
        else if (fileName.includes('indeed')) setSource('indeed');
        else if (fileName.includes('prosple')) setSource('prosple');
        else if (fileName.includes('linkedin')) setSource('linkedin');
      } else {
        alert('Please select a CSV or XLSX file');
      }
    }
  };

  const convertXLSXToCSV = async (file: File): Promise<string> => {
    // For XLSX files, we need to convert them to CSV
    // This is a simple implementation - for production, you might want to use a library
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Try to parse as text first (might already be CSV)
          const text = e.target?.result as string;
          if (text.includes(',') || text.includes('\t')) {
            resolve(text);
          } else {
            reject(new Error('XLSX conversion not supported in browser. Please convert to CSV first.'));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      let csvData: string;
      
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        csvData = await convertXLSXToCSV(file);
      } else {
        csvData = await file.text();
      }

      const response = await fetch(`${API_BASE_URL}/internships/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          csvData,
          source: source || 'csv-import',
          removeDupes,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        // Refresh stats after successful import
        await fetchStats();
      }
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
    const confirmed = window.confirm(
      'Are you sure you want to delete ALL internships from the database? This action cannot be undone!'
    );
    
    if (!confirmed) return;

    const doubleConfirm = window.prompt(
      'Type "YES_DELETE_ALL" to confirm deletion:'
    );

    if (doubleConfirm !== 'YES_DELETE_ALL') {
      alert('Deletion cancelled');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/internships/clear-all`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ confirm: 'YES_DELETE_ALL' }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Successfully deleted ${data.deleted} internships`);
        await fetchStats();
      }
    } catch (error) {
      console.error('Clear error:', error);
      alert('Failed to clear database');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="mb-2">Data Import Manager</h1>
        <p className="text-gray-600">
          Import internship data from CSV/XLSX files into MongoDB
        </p>
      </div>

      {/* Statistics */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2">
            <Database className="size-5" />
            Database Statistics
          </h2>
          <Button
            onClick={fetchStats}
            disabled={loadingStats}
            variant="outline"
            size="sm"
          >
            {loadingStats ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              'Refresh'
            )}
          </Button>
        </div>

        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Internships</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-3xl text-green-600">{stats.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl text-gray-600">{stats.closed}</div>
              <div className="text-sm text-gray-600">Closed</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl text-purple-600">{stats.companies}</div>
              <div className="text-sm text-gray-600">Companies</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Click "Refresh" to load statistics
          </div>
        )}

        {stats && stats.sources.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3">Data Sources</h3>
            <div className="space-y-2">
              {stats.sources.map((s) => (
                <div key={s.source} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="capitalize">{s.source || 'Unknown'}</span>
                  <span className="text-gray-600">{s.count} records</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Import Form */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2">
          <Upload className="size-5" />
          Import Data
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block mb-2">
              Select CSV/XLSX File
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block mb-2">
              Data Source (optional)
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., internshala, indeed, prosple"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label htmlFor="remove-dupes" className="text-sm">
              Remove duplicates based on title and company
            </label>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex-1"
            >
              {importing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>

            <Button
              onClick={handleClearAll}
              variant="outline"
              className="text-red-600 hover:bg-red-50"
            >
              Clear All Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Import Result */}
      {result && (
        <Alert className={result.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="size-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="size-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <AlertDescription>
                {result.success ? (
                  <div>
                    <p className="mb-2">
                      Successfully imported {result.imported} internships!
                    </p>
                    {result.skipped && result.skipped > 0 && (
                      <p className="text-sm text-gray-600">
                        Skipped {result.skipped} duplicate(s)
                      </p>
                    )}
                    {result.invalid && result.invalid > 0 && (
                      <p className="text-sm text-gray-600">
                        Found {result.invalid} invalid record(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="mb-2">
                      Import failed: {result.error}
                    </p>
                    {result.invalidRecords && result.invalidRecords.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm">
                          View invalid records
                        </summary>
                        <pre className="mt-2 text-xs overflow-auto max-h-40 p-2 bg-white rounded">
                          {JSON.stringify(result.invalidRecords, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Instructions */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="mb-3">📝 Instructions</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>1. <strong>Select your CSV/XLSX file</strong> containing internship data</li>
          <li>2. <strong>Enter the source name</strong> (e.g., "internshala", "indeed") for tracking</li>
          <li>3. <strong>Click Import Data</strong> to upload to MongoDB</li>
          <li>4. The system automatically maps common field names from different platforms</li>
          <li>5. Duplicates are automatically detected based on title and company name</li>
        </ul>
        
        <div className="mt-4 p-3 bg-white rounded">
          <p className="text-sm mb-2"><strong>Supported CSV Column Names:</strong></p>
          <p className="text-xs text-gray-600">
            title, job_title, position, role | company, company_name, organization | 
            location, city | type, work_mode, mode | duration | stipend, salary, compensation | 
            description, job_description | skills, required_skills, key_skills | and more...
          </p>
        </div>
      </Card>
    </div>
  );
}
