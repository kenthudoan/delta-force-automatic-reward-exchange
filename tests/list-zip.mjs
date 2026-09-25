// List contents of a zip
import { readFileSync } from 'fs';
import { glob } from 'glob';

const zipBuffer = readFileSync('auto-redeem-code-delta-force-1.2.1.zip');

// Manual EOCD (End Of Central Directory) scan to list entries.
// Simpler: use built-in approach
import { execSync } from 'child_process';
const out = execSync('powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path \'auto-redeem-code-delta-force-1.2.1.zip\')).Entries | ForEach-Object { Write-Host ($_.FullName) }"', { encoding: 'utf8' });
console.log(out);
