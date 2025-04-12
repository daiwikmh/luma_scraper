import * as XLSX from 'xlsx';
import { Attendee } from './attendees';

export async function generateExcel(attendees: Attendee[], eventName: string): Promise<void> {
    try {
        // Create worksheet from attendee data
        const worksheet = XLSX.utils.json_to_sheet(attendees);
        
        // Create workbook and add worksheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendees');

        // Generate filename
        const fileName = `attendees_${eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`;

        // Write file
        XLSX.writeFile(workbook, fileName);
        console.log(`Excel file saved: ${fileName}`);
    } catch (error) {
        console.error('Error generating Excel file:', error);
        throw error;
    }
}