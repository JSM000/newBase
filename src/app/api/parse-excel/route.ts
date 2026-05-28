import { NextRequest, NextResponse } from 'next/server';
import { parseExcelBuffer } from '@/lib/excel-parser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('excel') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    const isXlsx =
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!isXlsx) {
      return NextResponse.json(
        { error: 'Excel 파일(.xlsx)만 업로드 가능합니다.' },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const parsed = parseExcelBuffer(buffer);

    return NextResponse.json({ success: true, parsed });
  } catch (err) {
    console.error('Excel parse error:', err);
    return NextResponse.json(
      { error: `파싱 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}` },
      { status: 500 },
    );
  }
}
