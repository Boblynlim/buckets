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
  worthRating: number;     // 1-5: "Was this worth it?"
  alignmentRating: number; // 1-5: "Does this align with your priorities?"
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
    'Worth Rating',
    'Alignment Rating',
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
    // Fall back to happinessRating for old records that predate the dual rating system
    const worthRating = expense.worthRating ?? expense.happinessRating ?? '';
    const alignmentRating = expense.alignmentRating ?? expense.happinessRating ?? '';
    const category = expense.category || '';
    const merchant = expense.merchant || '';
    const needsVsWants = expense.needsVsWants || '';

    return [
      date,
      bucket,
      amount,
      note,
      worthRating,
      alignmentRating,
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
    'Worth Rating',
    'Alignment Rating',
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
    '# - Worth Rating: 1-5 (Was this worth the money? 1=not at all, 5=absolutely)',
    '# - Alignment Rating: 1-5 (Does this align with your priorities? 1=not at all, 5=perfectly)',
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
      '3',
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
      '5',
      'Transportation',
      'Uber',
      'need',
    ].join(','),
  ];

  return [instructions, '', header, ...examples].join('\n');
};

/**
 * Parse CSV string to expense data.
 * Supports both the new 9-column format (with Worth Rating + Alignment Rating)
 * and the legacy 8-column format (with a single Happiness Rating).
 */
export const parseCSVToExpenses = (
  csvString: string,
  buckets: Bucket[]
): CSVExpense[] => {
  console.log('parseCSVToExpenses called');
  console.log('Raw CSV text:', csvString.substring(0, 500));

  const lines = csvString.trim().split('\n');
  console.log(`Total lines in CSV: ${lines.length}`);

  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid - need at least header and one data row');
  }

  console.log('Header line:', lines[0]);

  // Skip header
  const dataLines = lines.slice(1);
  console.log(`Data lines to process: ${dataLines.length}`);

  const expenses: CSVExpense[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) {
      console.log(`Line ${i + 2}: Empty, skipping`);
      continue;
    }
    if (line.startsWith('#')) {
      console.log(`Line ${i + 2}: Comment, skipping`);
      continue;
    }

    try {
      const fields = parseCSVLine(line);
      console.log(`Line ${i + 2}: Parsed ${fields.length} fields:`, fields);

      if (fields.length < 5) {
        console.warn(`Line ${i + 2}: Not enough fields (need at least 5, got ${fields.length}), skipping`);
        continue;
      }

      // Detect format by column count:
      // Legacy (8 cols): Date, Bucket, Amount, Note, HappinessRating, Category, Merchant, NeedsVsWants
      // New    (9 cols): Date, Bucket, Amount, Note, WorthRating, AlignmentRating, Category, Merchant, NeedsVsWants
      const isLegacyFormat = fields.length === 8 ||
        (fields.length >= 5 && !isNewFormatHeader(lines[0]));

      let dateStr: string,
          bucketName: string,
          amountStr: string,
          note: string,
          worthRatingStr: string,
          alignmentRatingStr: string,
          category: string,
          merchant: string,
          needsVsWants: string;

      if (isLegacyFormat) {
        [dateStr, bucketName, amountStr, note, worthRatingStr,
         category = '', merchant = '', needsVsWants = ''] = fields;
        alignmentRatingStr = worthRatingStr; // mirror the single rating into both
      } else {
        [dateStr, bucketName, amountStr, note, worthRatingStr, alignmentRatingStr,
         category = '', merchant = '', needsVsWants = ''] = fields;
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

      // Validate worth rating
      const worthRating = parseInt(worthRatingStr, 10);
      if (isNaN(worthRating) || worthRating < 1 || worthRating > 5) {
        throw new Error(`Worth Rating must be 1-5, got: ${worthRatingStr}`);
      }

      // Validate alignment rating
      const alignmentRating = parseInt(alignmentRatingStr, 10);
      if (isNaN(alignmentRating) || alignmentRating < 1 || alignmentRating > 5) {
        throw new Error(`Alignment Rating must be 1-5, got: ${alignmentRatingStr}`);
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

      const expense: CSVExpense = {
        date: dateStr,
        bucket: bucketName.trim(),
        amount,
        note: note.trim(),
        worthRating,
        alignmentRating,
        category: category.trim() || undefined,
        merchant: merchant.trim() || undefined,
        needsVsWants: validNeedsVsWants,
      };

      console.log(`Line ${i + 2}: Successfully parsed expense:`, expense);
      expenses.push(expense);
    } catch (error) {
      const errorMsg = `Line ${i + 2}: ${(error as Error).message}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  console.log(`Total expenses parsed: ${expenses.length}`);
  return expenses;
};

/**
 * Check whether the header row belongs to the new 9-column format.
 */
function isNewFormatHeader(headerLine: string): boolean {
  const lower = headerLine.toLowerCase();
  return lower.includes('worth rating') || lower.includes('alignment rating');
}

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
    '- Worth Rating: 1-5 (Was this worth the money? 1=not at all, 5=absolutely)',
    '- Alignment Rating: 1-5 (Does this align with your priorities? 1=not at all, 5=perfectly)',
    '- Needs vs Wants: either "need" or "want"',
    '- Download as CSV when done: File > Download > CSV',
    '',
    'YOUR BUCKETS:',
    ...buckets.map(b => `- ${b.name}`),
    '',
  ].join('\n');

  return instructions;
};
