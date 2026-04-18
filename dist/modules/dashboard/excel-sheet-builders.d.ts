/**
 * excel-sheet-builders.ts — ExcelJS worksheet builders for each report type.
 * Each function adds a worksheet to the provided workbook and populates it with data.
 */
import ExcelJS from 'exceljs';
export declare function buildMessagesSheet(workbook: ExcelJS.Workbook, orgId: string, from: string, to: string): Promise<void>;
export declare function buildContactsSheet(workbook: ExcelJS.Workbook, orgId: string, from: string, to: string): Promise<void>;
export declare function buildAppointmentsSheet(workbook: ExcelJS.Workbook, orgId: string, from: string, to: string): Promise<void>;
//# sourceMappingURL=excel-sheet-builders.d.ts.map