import type { Expense, Bucket } from '../types';

/**
 * CSV Export/Import Utilities
 * Handles exporting and importing expense data
 */

export interface CSVExpense {
  date: string; // YYYY-MM-DD format
  bucket: string;
  amount: number;
  note: string;
  worthIt: boolean;
  isNecessary: boolean;
  category?: string;
  merchant?: string;
  needsVsWants?: 'need' | 'want';
  // Legacy fields — kept for backward-compat parsing only
  worthRating?: number;
  alignmentRating?: number;
}

/**
 * Convert expenses to CSV string
 */
export const exportExpensesToCSV = (
  expenses: Expense[],
  buckets: Bucket[]
): string => {
  // Create bucket ID to name map
  const bucketMap = new Map(buckets.map(b => [b._id, b.name]));

  // CSV Header
  const header = [
    'Date',
    'Bucket',
    'Amount',
    'Note',
    'Worth It',
    'Necessary',
    'Category',
    'Merchant',
    'Needs vs Wants',
  ].join(',');

  // CSV Rows
  const rows = expenses.map(expense => {
    const date = new Date(expense.date).toISOString().split('T')[0]; // YYYY-MM-DD
    const bucket = bucketMap.get(expense.bucketId) || 'Unknown';
    const amount = expense.amount.toFixed(2);
    const note = `"${expense.note.replace(/"/g, '""')}"`; // Escape quotes
    const worthIt = expense.worthIt ? 'yes' : 'no';
    const isNecessary = expense.isNecessary ? 'yes' : 'no';
    const category = expense.category || '';
    const merchant = expense.merchant || '';
    const needsVsWants = expense.needsVsWants || '';

    return [
      date,
      bucket,
      amount,
      note,
      worthIt,
      isNecessary,
      category,
      merchant,
      needsVsWants,
    ].join(',');
  });

  return [header, ...rows].join('\n');
};

/**
 * Generate CSV template for import with user's actual buckets
 */
export const generateCSVTemplate = (buckets: Bucket[]): string => {
  const header = [
    'Date',
    'Bucket',
    'Amount',
    'Note',
    'Worth It',
    'Necessary',
    'Category',
    'Merchant',
    'Needs vs Wants',
  ].join(',');

  // Instructions comment
  const instructions = [
    '# INSTRUCTIONS:',
    '# - Date format: YYYY-MM-DD (e.g., 2024-01-15)',
    '# - Bucket: Choose from your buckets listed below',
    `# - Available Buckets: ${buckets.map(b => b.name).join(', ')}`,
    '# - Amount: Number without currency symbol (e.g., 45.50)',
    '# - Note: Description in quotes if it contains commas',
    '# - Worth It: "yes" or "no" (was this purchase worth it?)',
    '# - Necessary: "yes" or "no" (is this a necessary/essential expense?)',
    '# - Category: Optional (e.g., Food & Dining, Transportation)',
    '# - Merchant: Optional (e.g., Whole Foods, Uber)',
    '# - Needs vs Wants: Optional - either "need" or "want"',
    '# ',
    '# Delete these instruction lines and the example rows before importing your data',
    '#',
  ].join('\n');

  // Example rows using actual bucket names if available
  const firstBucket = buckets[0]?.name || 'Groceries';
  const secondBucket = buckets[1]?.name || 'Entertainment';
  const thirdBucket = buckets[2]?.name || 'Transportation';

  const examples = [
    [
      '2024-01-15',
      firstBucket,
      '45.50',
      '"Weekly groceries"',
      'yes',
      'yes',
      'Food & Dining',
      'Whole Foods',
      'need',
    ].join(','),
    [
      '2024-01-16',
      secondBucket,
      '12.99',
      '"Subscription"',
      'yes',
      'no',
      'Entertainment',
      'Netflix',
      'want',
    ].join(','),
    [
      '2024-01-17',
      thirdBucket,
      '25.00',
      '"Ride to work"',
      'no',
      'no',
      'Transportation',
      'Uber',
      'need',
    ].join(','),
  ];

  return [instructions, '', header, ...examples].join('\n');
};

/**
 * Detect CSV format from header line
 */
function detectFormat(headerLine: string): 'new' | 'legacy-dual' | 'legacy-single' {
  const lower = headerLine.toLowerCase();
  if (lower.includes('worth it') && lower.includes('necessary')) return 'new';
  if (lower.includes('worth rating') || lower.includes('alignment rating')) return 'legacy-dual';
  return 'legacy-single';
}

/**
 * Parse CSV string to expense data.
 * Supports:
 *  - New format: Date, Bucket, Amount, Note, Worth It, Necessary, Category, Merchant, Needs vs Wants
 *  - Legacy 9-col: Date, Bucket, Amount, Note, Worth Rating, Alignment Rating, Category, Merchant, Needs vs Wants
 *  - Legacy 8-col: Date, Bucket, Amount, Note, Happiness Rating, Category, Merchant, Needs vs Wants
 */
export const parseCSVToExpenses = (
  csvString: string,
  buckets: Bucket[]
): CSVExpense[] => {
  const lines = csvString.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid - need at least header and one data row');
  }

  const format = detectFormat(lines[0]);

  // Skip header
  const dataLines = lines.slice(1);
  const expenses: CSVExpense[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line || line.startsWith('#')) continue;

    try {
      const fields = parseCSVLine(line);

      if (fields.length < 5) {
        console.warn(`Line ${i + 2}: Not enough fields (need at least 5, got ${fields.length}), skipping`);
        continue;
      }

      let dateStr: string,
          bucketName: string,
          amountStr: string,
          note: string,
          worthIt = false,
          isNecessary = false,
          category = '',
          merchant = '',
          needsVsWants = '';

      if (format === 'new') {
        // New format: Date, Bucket, Amount, Note, Worth It, Necessary, Category, Merchant, Needs vs Wants
        let worthItStr: string, necessaryStr: string;
        [dateStr, bucketName, amountStr, note, worthItStr, necessaryStr,
         category = '', merchant = '', needsVsWants = ''] = fields;

        worthIt = worthItStr?.toLowerCase().trim() === 'yes';
        isNecessary = necessaryStr?.toLowerCase().trim() === 'yes';
      } else if (format === 'legacy-dual') {
        // Legacy 9-col: Date, Bucket, Amount, Note, Worth Rating, Alignment Rating, ...
        let worthRatingStr: string;
        [dateStr, bucketName, amountStr, note, worthRatingStr, ,
         category = '', merchant = '', needsVsWants = ''] = fields;

        const wr = parseInt(worthRatingStr, 10);
        worthIt = !isNaN(wr) && wr >= 4; // 4-5 = worth it
      } else {
        // Legacy 8-col: Date, Bucket, Amount, Note, Happiness Rating, Category, Merchant, Needs vs Wants
        let happinessStr: string;
        [dateStr, bucketName, amountStr, note, happinessStr,
         category = '', merchant = '', needsVsWants = ''] = fields;

        const hr = parseInt(happinessStr, 10);
        worthIt = !isNaN(hr) && hr >= 4;
      }

      // Validate date
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${dateStr}`);
      }

      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        throw new Error(`Invalid amount: ${amountStr}`);
      }

      // Validate needsVsWants if provided
      let validNeedsVsWants: 'need' | 'want' | undefined = undefined;
      if (needsVsWants) {
        const normalized = needsVsWants.toLowerCase().trim();
        if (normalized === 'need' || normalized === 'want') {
          validNeedsVsWants = normalized;
        }
      }

      expenses.push({
        date: dateStr,
        bucket: bucketName.trim(),
        amount,
        note: note.trim(),
        worthIt,
        isNecessary,
        category: category.trim() || undefined,
        merchant: merchant.trim() || undefined,
        needsVsWants: validNeedsVsWants,
      });
    } catch (error) {
      const errorMsg = `Line ${i + 2}: ${(error as Error).message}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  return expenses;
};

/**
 * Helper to parse a CSV line with quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField);
  return fields;
}

/**
 * Download CSV file (Web only)
 */
export const downloadCSV = (content: string, filename: string) => {
  if (typeof document === 'undefined') {
    console.warn('downloadCSV is only available on web');
    return;
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generate a Google Sheets template URL with data validation dropdown for buckets
 */
export const generateGoogleSheetsTemplate = (buckets: Bucket[]): string => {
  const bucketNames = buckets.map(b => b.name).join(', ');

  const instructions = [
    'BUCKETS IMPORT TEMPLATE',
    '',
    'INSTRUCTIONS:',
    '- Fill in your expenses below the header row',
    `- For Bucket column, use dropdown or type exactly: ${bucketNames}`,
    '- Date format: YYYY-MM-DD (e.g., 2024-01-15)',
    '- Worth It: "yes" or "no" (was this purchase worth the money?)',
    '- Necessary: "yes" or "no" (is this an essential/necessary expense?)',
    '- Needs vs Wants: either "need" or "want"',
    '- Download as CSV when done: File > Download > CSV',
    '',
    'YOUR BUCKETS:',
    ...buckets.map(b => `- ${b.name}`),
    '',
  ].join('\n');

  return instructions;
};
