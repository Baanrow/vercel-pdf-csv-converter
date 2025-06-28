import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Set max duration for serverless function

/**
 * Parse healthcare claims data from text
 * @param {string} text - The extracted PDF text
 * @returns {Array} - Array of structured data records
 */
function parseHealthcareClaims(text) {
  // Split the text into lines
  const lines = text.split('\n');
  
  // Parse individual patient claims
  const claims = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Normalize spaces for checking
    const normalizedLine = line.replace(/\s+/g, ' ').trim();
    
    // Look for patient line - must have all required fields
    if (normalizedLine && normalizedLine.includes('PATIENT:') && normalizedLine.includes('PATIENT ID #:') && normalizedLine.includes('PAT CTRL #:') && normalizedLine.includes('CLM #:')) {
      
      // Initialize claim object with all fields
      const claim = {
        // Patient info fields (from line 1)
        patientName: '',
        patientId: '',
        patientControlNumber: '',
        claimNumber: '',
        // Claim status fields (from line 2)
        claimStatus: '',
        claimType: '',
        authRefNumber: '',
        // Provider fields (from line 3)
        renderingProvider: '',
        renderingProviderId: '',
        // Service line fields
        lineItem: '',
        dosStartDate: '',
        dosEndDate: '',
        procedureCode: '',
        modifier: '',
        charge: '',
        nbr: '',
        grpCd: '',
        adjRsn: '',
        adjAmt: '',
        adjQty: '',
        pdQty: '',
        payment: '',
        // Payment summary fields
        patientResponsibility: '',
        totalCharge: '',
        totalPayment: ''
      };
      
      // Parse patient line (line 1)
      // Format: PATIENT: JOHN SMITH   PATIENT ID #: 1234567800   PAT CTRL #: CLM00102102   CLM #: 2025007654321
      // Use normalized line for regex to handle multiple spaces
      const patientMatch = normalizedLine.match(/PATIENT:\s+(.+?)\s+PATIENT ID #:\s+(\d+)\s+PAT CTRL #:\s+(\S+)\s+CLM #:\s+(\d+)/);
      if (patientMatch) {
        claim.patientName = patientMatch[1].trim();
        claim.patientId = patientMatch[2];
        claim.patientControlNumber = patientMatch[3];
        claim.claimNumber = patientMatch[4];
      }
      
      // Move to claim status line (line 2)
      i++;
      if (i < lines.length) {
        const statusLine = lines[i].replace(/\s+/g, ' ').trim();
        // Format: CLAIM STATUS: DENIED   CLAIM TYPE: HM   AUTH/REF# :
        const statusMatch = statusLine.match(/CLAIM STATUS:\s+(\S+)\s+CLAIM TYPE:\s+(\S+)\s+AUTH\/REF#\s*:\s*(\S*)/);
        if (statusMatch) {
          claim.claimStatus = statusMatch[1];
          claim.claimType = statusMatch[2];
          claim.authRefNumber = statusMatch[3] || '';
        }
      }
      
      // Move to provider line (line 3)
      i++;
      if (i < lines.length) {
        const providerLine = lines[i];
        // Format: REND PROV:    REND PROV ID:
        const providerMatch = providerLine.match(/REND PROV:\s*([^\s]*)\s*REND PROV ID:\s*(\S*)/);
        if (providerMatch) {
          claim.renderingProvider = providerMatch[1] || '';
          claim.renderingProviderId = providerMatch[2] || '';
        }
      }
      
      // Look for service line data
      // It might not be immediately after due to page breaks
      let foundServiceLine = false;
      let searchLimit = Math.min(i + 20, lines.length); // Search up to 20 lines ahead
      
      for (let j = i + 1; j < searchLimit; j++) {
        const currentLine = lines[j];
        
        // Check if this is a service line (starts with two digits)
        if (currentLine.match(/^\d{2}\s+\d{8}\s+\d{8}\s/)) {
          
          // Parse the service line
          const parts = currentLine.trim().split(/\s+/);
          
          if (parts.length >= 13 && parts[0].match(/^\d{2}$/)) {
            claim.lineItem = parts[0];
            claim.dosStartDate = parts[1];
            claim.dosEndDate = parts[2];
            claim.procedureCode = parts[3];
            claim.modifier = parts[4];
            claim.charge = parts[5];
            claim.nbr = parts[6];
            claim.grpCd = parts[7];
            claim.adjRsn = parts[8];
            claim.adjAmt = parts[9];
            claim.adjQty = parts[10];
            claim.pdQty = parts[11];
            claim.payment = parts[12];
            foundServiceLine = true;
            
            // Now look for PAT RESP line after the service line
            for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
              const patRespLine = lines[k];
              if (patRespLine.includes('PAT RESP:')) {
                const normalizedPatResp = patRespLine.replace(/\s+/g, ' ').trim();
                const patRespMatch = normalizedPatResp.match(/PAT RESP:\s+([\d.-]+)\s+TOTAL CHARGE:\s+([\-\d.]+)\s+TOTAL PAYMENT:\s+([\d.-]+)/);
                if (patRespMatch) {
                  claim.patientResponsibility = patRespMatch[1];
                  claim.totalCharge = patRespMatch[2];
                  claim.totalPayment = patRespMatch[3];
                }
                break;
              }
            }
            break;
          }
        }
      }
      
      if (!foundServiceLine) {
        // Check if this might be a continuation from a previous page
        // Look backwards for service line data
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          const currentLine = lines[j];
          if (currentLine.match(/^\d{2}\s+\d{8}\s+\d{8}\s/)) {
            
            const parts = currentLine.trim().split(/\s+/);
            if (parts.length >= 13 && parts[0].match(/^\d{2}$/)) {
              claim.lineItem = parts[0];
              claim.dosStartDate = parts[1];
              claim.dosEndDate = parts[2];
              claim.procedureCode = parts[3];
              claim.modifier = parts[4];
              claim.charge = parts[5];
              claim.nbr = parts[6];
              claim.grpCd = parts[7];
              claim.adjRsn = parts[8];
              claim.adjAmt = parts[9];
              claim.adjQty = parts[10];
              claim.pdQty = parts[11];
              claim.payment = parts[12];
              foundServiceLine = true;
              break;
            }
          }
        }
      }
      
      // Add the claim to our results
      claims.push(claim);
    }
    
    i++;
  }
  
  return claims;
}


/**
 * Convert parsed data to CSV format
 * @param {Array} records - The parsed records
 * @returns {string} - CSV formatted string
 */
function convertToCSV(records) {
  if (records.length === 0) {
    return 'No data found in the PDF';
  }
  
  // Define headers for all 25 fields
  const headers = [
    'Patient Name',
    'Patient ID',
    'Patient Control Number',
    'Claim Number',
    'Claim Status',
    'Claim Type',
    'Auth/Ref Number',
    'Rendering Provider',
    'Rendering Provider ID',
    'Line Item',
    'DOS Start Date',
    'DOS End Date',
    'Procedure Code',
    'Modifier',
    'Charge',
    'NBR',
    'Group Code',
    'Adj Reason',
    'Adj Amount',
    'Adj Qty',
    'PD Qty',
    'Payment',
    'Patient Responsibility',
    'Total Charge',
    'Total Payment'
  ];
  
  // Start with the header row
  let csvContent = headers.map(header => escapeCSV(header)).join(',') + '\r\n';
  
  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    // Map record to CSV row
    const row = [
      record.patientName,
      record.patientId,
      record.patientControlNumber,
      record.claimNumber,
      record.claimStatus,
      record.claimType,
      record.authRefNumber,
      record.renderingProvider,
      record.renderingProviderId,
      record.lineItem,
      record.dosStartDate,
      record.dosEndDate,
      record.procedureCode,
      record.modifier,
      record.charge,
      record.nbr,
      record.grpCd,
      record.adjRsn,
      record.adjAmt,
      record.adjQty,
      record.pdQty,
      record.payment,
      record.patientResponsibility,
      record.totalCharge,
      record.totalPayment
    ];
    
    // Add the row to CSV content
    csvContent += row.map(field => escapeCSV(field)).join(',') + '\r\n';
  }
  
  return csvContent;
}

/**
 * Escape special characters for CSV
 * @param {string} value - The value to escape
 * @returns {string} - Escaped value
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  value = String(value);
  
  // If the value contains a comma, newline, or double quote, wrap it in double quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    // Replace double quotes with two double quotes
    value = value.replace(/"/g, '""');
    // Wrap in quotes
    value = `"${value}"`;
  }
  
  return value;
}

export async function POST(request) {
  try {
    // Parse the form data
    const formData = await request.formData();
    
    // Get the file from form data
    const file = formData.get('pdfFile');
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    // Get file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    try {
      // Parse PDF to text - using Buffer.from instead of deprecated Buffer constructor
      const buffer = Buffer.from(fileBuffer);
      const pdfData = await pdfParse(buffer);
      
      // Parse healthcare claims from the text
      const claims = parseHealthcareClaims(pdfData.text);
      
      // Convert to CSV
      const csvContent = convertToCSV(claims);
      
      // Return CSV as a file download
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${file.name.replace('.pdf', '')}_converted.csv"`,
        },
      });
      
    } catch (pdfError) {
      return NextResponse.json({ 
        error: 'Failed to parse PDF file',
        details: pdfError.message || 'Unknown PDF parsing error'
      }, { status: 422 });
    }
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 