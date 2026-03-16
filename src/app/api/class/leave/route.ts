/**
 * ============================================================================
 * 文件: src/app/api/class/leave/route.ts
 * 目录: 请假记录 API
 * 功能: 
 *   - GET: 获取请假记录列表
 *   - POST: 创建请假记录（支持日期范围/固定星期）
 *   - DELETE: 删除请假记录
 * 
 * 数据存储: 本地内存存储（重启后数据丢失）
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/storage/local/memory-store';
import { saveToFile } from '@/storage/local/file-store';

// 获取请假记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const memberId = searchParams.get('memberId');

    const store = getStore();

    let records;
    if (memberId) {
      records = store.getLeaveRecordByMember(memberId);
    } else if (classId) {
      records = store.getLeaveRecordsByClass(classId);
    } else {
      return NextResponse.json({ error: '缺少班级ID或成员ID' }, { status: 400 });
    }

    return NextResponse.json({ records });
  } catch (error) {
    console.error('获取请假记录失败:', error);
    return NextResponse.json({ error: '获取请假记录失败' }, { status: 500 });
  }
}

// 创建请假记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, classId, leaveType, startDate, endDate, dayOfWeek, checkInTime, reason, imageUrl } = body;

    if (!memberId || !classId || !leaveType) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证请假类型
    if (leaveType === 'range' && (!startDate || !endDate)) {
      return NextResponse.json({ error: '日期范围请假需要填写开始和结束日期' }, { status: 400 });
    }

    if (leaveType === 'weekday' && dayOfWeek === undefined) {
      return NextResponse.json({ error: '固定星期几请假需要选择星期' }, { status: 400 });
    }

    const store = getStore();

    // 检查成员是否存在
    const member = store.getMember(memberId);
    if (!member) {
      return NextResponse.json({ error: '成员不存在' }, { status: 404 });
    }

    // 创建请假记录
    const record = store.createLeaveRecord({
      class_id: classId,
      member_id: memberId,
      member_name: member.name,
      start_date: leaveType === 'range' ? startDate : '',
      end_date: leaveType === 'range' ? endDate : '',
      leave_type: leaveType,
      day_of_week: leaveType === 'weekday' ? dayOfWeek : undefined,
      check_in_time: checkInTime || 'all',
      reason: reason || '',
      image_url: imageUrl || undefined
    });

    // 保存到文件
    saveToFile();

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('创建请假记录失败:', error);
    return NextResponse.json({ error: '创建请假记录失败' }, { status: 500 });
  }
}

// 删除请假记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少请假记录ID' }, { status: 400 });
    }

    const store = getStore();
    
    const success = store.deleteLeaveRecord(id);

    if (!success) {
      return NextResponse.json({ error: '请假记录不存在' }, { status: 404 });
    }

    // 保存到文件
    saveToFile();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除请假记录失败:', error);
    return NextResponse.json({ error: '删除请假记录失败' }, { status: 500 });
  }
}
