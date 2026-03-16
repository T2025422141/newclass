/**
 * 数据导出 API
 * 
 * GET: 导出签到数据
 * 数据存储: 本地内存存储
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/storage/local/memory-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date');

    const store = getStore();

    // 获取签到记录
    let records;
    if (classId) {
      records = store.getCheckInRecordsByClass(classId, date || undefined);
    } else {
      const allData = store.exportAllData();
      records = allData.checkInRecords;
    }

    // 转换为 CSV
    const csv = convertToCSV(records);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="checkin-${date || 'all'}.csv"`
      }
    });
  } catch (error) {
    console.error('导出失败:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}

function convertToCSV(records: any[]): string {
  if (records.length === 0) {
    return 'No records';
  }

  const headers = ['ID', '班级ID', '成员ID', '成员姓名', '状态', '签到时间', '签到时段', '备注', '距离'];
  const rows = records.map(r => [
    r.id,
    r.class_id,
    r.member_id,
    r.member_name,
    r.status,
    r.check_in_time,
    r.check_in_type,
    r.note || '',
    r.distance || ''
  ]);

  const BOM = '\uFEFF';
  return BOM + [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
}

function escapeCSV(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
