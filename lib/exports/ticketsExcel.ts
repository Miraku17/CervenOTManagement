import * as XLSX from 'xlsx-js-style';

// Shared styled Excel workbook builder for ticket exports.
// Used by the ticketing overview dashboard and the tickets list page.
export const convertTicketsToExcel = (tickets: any[]) => {
  if (!tickets || tickets.length === 0) return null;

  const ticketData: any[][] = [];

  // Add title row
  ticketData.push(['Ticket Export Report']);
  ticketData.push([]); // Empty row

  // Add headers
  ticketData.push([
    'Ticket ID',
    'Store Name',
    'Store Code',
    'Station',
    'RCC Reference Number',
    'Date Reported',
    'Time Reported',
    'Request Type',
    'Device',
    'Problem Category',
    'Severity',
    'Status',
    'Request Detail',
    'Reported By',
    'Serviced By',
    'Manager on Duty',
    'Date Responded',
    'Time Responded',
    'Date Acknowledged',
    'Time Acknowledged',
    'Date Attended',
    'Store Arrival',
    'Work Start',
    'Work End',
    'Date Resolved',
    'Action Taken',
    'Final Resolution',
    'Parts Replaced',
    'New Parts Serial',
    'Old Parts Serial',
    'SLA Count (hrs)',
    'Downtime',
    'SLA Status'
  ]);

  // Add ticket data
  for (const ticket of tickets) {
    const storeName = (ticket.stores as any)?.store_name || 'N/A';
    const storeCode = (ticket.stores as any)?.store_code || 'N/A';
    const stationName = (ticket.stations as any)?.name || 'N/A';
    const reportedBy = ticket.reported_by_user
      ? `${ticket.reported_by_user.first_name} ${ticket.reported_by_user.last_name}`
      : 'N/A';
    const servicedBy = ticket.serviced_by_user
      ? `${ticket.serviced_by_user.first_name} ${ticket.serviced_by_user.last_name}`
      : 'N/A';
    const managerOnDuty = (ticket.store_managers as any)?.manager_name
      || (ticket.manager_on_duty as any)?.manager_name
      || 'N/A';

    ticketData.push([
      ticket.id || '',
      storeName,
      storeCode,
      stationName,
      ticket.rcc_reference_number || '',
      ticket.date_reported || '',
      ticket.time_reported || '',
      (ticket.request_types as any)?.name || ticket.request_type || '',
      ticket.device || '',
      (ticket.problem_categories as any)?.name || ticket.problem_category || '',
      ticket.sev || '',
      ticket.status || '',
      ticket.request_detail || '',
      reportedBy,
      servicedBy,
      managerOnDuty,
      ticket.date_responded || '',
      ticket.time_responded || '',
      ticket.date_ack || '',
      ticket.time_ack || '',
      ticket.date_attended || '',
      ticket.store_arrival || '',
      ticket.work_start || '',
      ticket.work_end || '',
      ticket.date_resolved || '',
      ticket.action_taken || '',
      ticket.final_resolution || '',
      ticket.parts_replaced || '',
      ticket.new_parts_serial || '',
      ticket.old_parts_serial || '',
      ticket.sla_count_hrs || '',
      ticket.downtime || '',
      ticket.sla_status || ''
    ]);
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(ticketData);

  // Apply styling
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  // Set column widths
  const colWidths = [
    { wch: 12 },  // Ticket ID
    { wch: 20 },  // Store Name
    { wch: 12 },  // Store Code
    { wch: 15 },  // Station
    { wch: 18 },  // RCC Reference
    { wch: 12 },  // Date Reported
    { wch: 12 },  // Time Reported
    { wch: 15 },  // Request Type
    { wch: 15 },  // Device
    { wch: 18 },  // Problem Category
    { wch: 10 },  // Severity
    { wch: 12 },  // Status
    { wch: 30 },  // Request Detail
    { wch: 20 },  // Reported By
    { wch: 20 },  // Serviced By
    { wch: 20 },  // Manager
    { wch: 12 },  // Date Responded
    { wch: 12 },  // Time Responded
    { wch: 12 },  // Date Ack
    { wch: 12 },  // Time Ack
    { wch: 12 },  // Date Attended
    { wch: 12 },  // Store Arrival
    { wch: 12 },  // Work Start
    { wch: 12 },  // Work End
    { wch: 12 },  // Date Resolved
    { wch: 30 },  // Action Taken
    { wch: 30 },  // Final Resolution
    { wch: 20 },  // Parts Replaced
    { wch: 18 },  // New Parts Serial
    { wch: 18 },  // Old Parts Serial
    { wch: 12 },  // SLA Count
    { wch: 12 },  // Downtime
    { wch: 12 }   // SLA Status
  ];
  worksheet['!cols'] = colWidths;

  // Apply cell styles
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) continue;

      const cell = worksheet[cellAddress];

      // Initialize cell style
      if (!cell.s) cell.s = {};

      // Title row (row 0)
      if (R === 0) {
        cell.s = {
          fill: { fgColor: { rgb: "1e40af" } },
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }
      // Header row (row 2)
      else if (R === 2) {
        cell.s = {
          fill: { fgColor: { rgb: "3b82f6" } },
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }
      // Data rows
      else if (R > 2) {
        const isEvenRow = (R - 3) % 2 === 0;
        cell.s = {
          fill: { fgColor: { rgb: isEvenRow ? "dbeafe" : "FFFFFF" } },
          alignment: { horizontal: "left", vertical: "top", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "cbd5e1" } },
            bottom: { style: "thin", color: { rgb: "cbd5e1" } },
            left: { style: "thin", color: { rgb: "cbd5e1" } },
            right: { style: "thin", color: { rgb: "cbd5e1" } }
          }
        };
      }
    }
  }

  // Merge cells for title
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 32 } }];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

  return workbook;
};

// Build and trigger a browser download of the tickets workbook.
export const downloadTicketsExcel = (tickets: any[], filename: string): boolean => {
  const workbook = convertTicketsToExcel(tickets);
  if (!workbook) return false;

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return true;
};
