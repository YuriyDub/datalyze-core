import csv from 'csv-parser';
import fs from 'fs';
import xlsx from 'xlsx';
import { parseStringPromise } from 'xml2js';

export const csvToJson = (filePath: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

export const excelToJson = (filePath: string): any[] => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
};

export const xmlToJson = async (filePath: string): Promise<any> => {
  const xmlData = fs.readFileSync(filePath, 'utf-8');
  return await parseStringPromise(xmlData);
};