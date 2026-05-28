import { ParsedFile } from '@/types/score';

export interface ParseExcelResponse {
  success: boolean;
  parsed: ParsedFile;
}

export async function parseExcelApi(file: File): Promise<ParseExcelResponse> {
  const fd = new FormData();
  fd.append('excel', file);
  const res = await fetch('/api/parse-excel', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '서버 오류');
  return data;
}
