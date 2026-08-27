import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';

export async function exportToExcel(data: any[], fileName: string) {
  if (!data || data.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  const headers = Object.keys(data[0]);

  // Define columns
  worksheet.columns = headers.map(header => ({
    header,
    key: header,
    width: header === 'QRCode' ? 18 : 25,
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0055A4' }, // Mubea Blue
    };
    cell.font = {
      color: { argb: 'FFFFFFFF' },
      bold: true,
      size: 12,
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  headerRow.height = 30;

  // Add rows
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const row = worksheet.addRow(item);
    
    let hasQRCode = false;

    // Style data cells
    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { size: 11 };
      
      const header = headers[colNumber - 1];
      if (header === 'QRCode' && item[header]) {
        hasQRCode = true;
        cell.value = ''; // Clear text value as we'll place an image
      }
    });

    if (hasQRCode) {
      row.height = 100;
    } else {
      row.height = 25;
    }
  }

  // Generate QR codes and embed them
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const qrColIndex = headers.indexOf('QRCode');
    
    if (qrColIndex !== -1 && item['QRCode']) {
      try {
        const qrBase64 = await QRCode.toDataURL(item['QRCode'], { width: 100, margin: 1 });
        
        const imageId = workbook.addImage({
          base64: qrBase64,
          extension: 'png',
        });

        worksheet.addImage(imageId, {
          tl: { col: qrColIndex + 0.1, row: i + 1 + 0.1 }, // offset slightly from top left
          ext: { width: 90, height: 90 },
          editAs: 'oneCell'
        });
      } catch (err) {
        console.error('Failed to generate QR code for cell', err);
      }
    }
  }

  // Generate and save file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${fileName}.xlsx`);
}
