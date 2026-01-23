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
  happinessRating: number; // 1-5
  category?: string;
  merchant?: string;
  needsVsWants?: 'need' | 'want';
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
    'Happiness Rating',
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
    const happinessRating = expense.happinessRating;
    const category = expense.category || '';
    const merchant = expense.merchant || '';
    const needsVsWants = expense.needsVsWants || '';

    return [
      date,
      bucket,
      amount,
      note,
      happinessRating,
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
    'Happiness Rating',
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
    '# - Happiness Rating: 1-5 (1=worst, 5=best)',
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
      '4',
      'Food & Dining',
      'Whole Foods',
      'need',
    ].join(','),
    [
      '2024-01-16',
      secondBucket,
      '12.99',
      '"Subscription"',
      '5',
      'Entertainment',
      'Netflix',
      'want',
    ].join(','),
    [
      '2024-01-17',
      thirdBucket,
      '25.00',
      '"Ride to work"',
      '3',
      'Transportation',
      'Uber',
      'need',
    ].join(','),
  ];

  return [instructions, '', header, ...examples].join('\n');
};

/**
 * Parse CSV string to expense data
 */
export const parseCSVToExpenses = (
  csvString: string,
  buckets: Bucket[]
): CSVExpense[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  // Skip header
  const dataLines = lines.slice(1);

  const expenses: CSVExpense[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue; // Skip empty lines
    if (line.startsWith('#')) continue; // Skip comment lines

    try {
      // Parse CSV line (handle quoted fields)
      const fields = parseCSVLine(line);

      if (fields.length < 5) {
        console.warn(`Line ${i + 2}: Not enough fields, skipping`);
        continue;
      }

      const [
        dateStr,
        bucketName,
        amountStr,
        note,
        happinessStr,
        category = '',
        merchant = '',
        needsVsWants = '',
      ] = fields;

      // Validate date
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${dateStr}`);
      }

      // Note: We no longer throw error for unknown bucket here
      // The preview UI will handle validation and allow users to select correct bucket

      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        throw new Error(`Invalid amount: ${amountStr}`);
      }

      // Validate happiness rating
      const happinessRating = parseInt(happinessStr, 10);
      if (isNaN(happinessRating) || happinessRating < 1 || happinessRating > 5) {
        throw new Error(`Happiness rating must be 1-5, got: ${happinessStr}`);
      }

      // Validate needsVsWants if provided
      let validNeedsVsWants: 'need' | 'want' | undefined = undefined;
      if (needsVsWants) {
        const normalized = needsVsWants.toLowerCase();
        if (normalized === 'need' || normalized === 'want') {
          validNeedsVsWants = normalized;
        } else {
          console.warn(`Line ${i + 2}: Invalid needsVsWants value "${needsVsWants}", ignoring`);
        }
      }

      expenses.push({
        date: dateStr,
        bucket: bucketName.trim(), // Trim bucket name to handle extra whitespace
        amount,
        note: note.trim(),
        happinessRating,
        category: category.trim() || undefined,
        merchant: merchant.trim() || undefined,
        needsVsWants: validNeedsVsWants,
      });
    } catch (error) {
      throw new Error(`Line ${i + 2}: ${(error as Error).message}`);
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
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Add last field
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

  // Create the template data
  const instructions = [
    'BUCKETS IMPORT TEMPLATE',
    '',
    'INSTRUCTIONS:',
    '- Fill in your expenses below the header row',
    `- For Bucket column, use dropdown or type exactly: ${bucketNames}`,
    '- Date format: YYYY-MM-DD (e.g., 2024-01-15)',
    '- Happiness Rating: 1-5 (1=worst, 5=best)',
    '- Needs vs Wants: either "need" or "want"',
    '- Download as CSV when done: File > Download > CSV',
    '',
    'YOUR BUCKETS:',
    ...buckets.map(b => `- ${b.name}`),
    '',
  ].join('\n');

  return instructions;
};
