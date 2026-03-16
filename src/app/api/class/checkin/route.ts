/**
 * ============================================================================
 * 文件: src/app/api/class/checkin/route.ts
 * 目录: 签到记录 API
 * 功能: 
 *   - GET: 获取签到记录列表（含请假状态）
 *   - POST: 提交签到（含位置验证）
 *   - DELETE: 重置签到记录
 * 
 * 数据存储: 本地内存存储（重启后数据丢失）
 * 依赖: Haversine公式计算GPS距离
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/storage/local/memory-store';
import { saveToFile } from '@/storage/local/file-store';

/**
 * 使用Haversine公式计算两点距离（米）
 * 不调用第三方API，本地计算
 */
function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 获取签到记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const checkInType = searchParams.get('period') || 'morning';
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const store = getStore();
    
    // 获取成员列表
    const members = store.getMembersByClass(classId);

    // 获取当日该时段的签到记录
    const records = store.getCheckInRecordsByClass(classId, date, checkInType);

    // 获取有效的请假记录
    const leaveRecords = store.getActiveLeaveRecords(classId, date, checkInType as 'morning' | 'evening');
    const validLeaveMap = new Map(leaveRecords.map(l => [l.member_id, l]));

    // 组合数据
    const checkInMap = new Map(records.map(r => [r.member_id, r]));

    const result = members.map(member => {
      const record = checkInMap.get(member.id);
      const leaveRecord = validLeaveMap.get(member.id);
      
      return {
        id: member.id,
        name: member.name,
        checkedIn: !!record,
        record: record || null,
        hasValidLeave: !!leaveRecord,
        leaveRecord: leaveRecord ? {
          id: leaveRecord.id,
          leaveType: leaveRecord.leave_type,
          startDate: leaveRecord.start_date,
          endDate: leaveRecord.end_date,
          weekdays: leaveRecord.day_of_week !== undefined ? String(leaveRecord.day_of_week) : null,
          period: leaveRecord.check_in_time,
          reason: leaveRecord.reason,
          imageUrl: leaveRecord.image_url
        } : null
      };
    });

    return NextResponse.json({ 
      date,
      period: checkInType,
      members: result,
      total: members.length,
      checkedIn: records.length
    });
  } catch (error) {
    console.error('获取签到记录失败:', error);
    return NextResponse.json({ error: '获取签到记录失败' }, { status: 500 });
  }
}

// 提交签到
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { memberId, classId, checkInType, status, note, imageUrl, latitude, longitude, userConfirmedLocation } = body;

    // 参数校验
    if (!memberId || !classId || !status) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 赣青二课必须上传图片
    if (status === '赣青二课' && !imageUrl) {
      return NextResponse.json({ error: '赣青二课必须上传活动截图' }, { status: 400 });
    }

    // 其他状态必须填写说明
    if (status === '其他' && !note) {
      return NextResponse.json({ error: '请填写说明' }, { status: 400 });
    }

    const validType = checkInType || 'morning';
    if (!['morning', 'evening', 'temporary'].includes(validType)) {
      return NextResponse.json({ error: '无效的签到时段' }, { status: 400 });
    }

    const store = getStore();

    // 1. 检查成员是否存在
    const member = store.getMember(memberId);
    if (!member) {
      return NextResponse.json({ error: '成员不存在' }, { status: 404 });
    }

    // 2. 检查是否已签到
    const today = new Date().toISOString().split('T')[0];
    const existing = store.getCheckInRecordByMember(memberId, today);
    
    // 检查同一时段是否已签到
    if (existing && existing.check_in_type === validType) {
      console.log('[CheckIn] 重复签到被拒绝', { memberId, date: today, period: validType });
      return NextResponse.json({ error: '该时段已签到' }, { status: 400 });
    }

    // 3. 获取签到设置
    const settings = store.getCheckInSetting(classId);

    // 4. 位置校验 - 仅在启用定位且正常出勤时验证
    let distance: number | undefined = undefined;
    let locationValid = true;
    
    // 只有启用定位且正常出勤需要位置验证
    const needLocationCheck = settings?.location_enabled && 
                              status === '正常出勤' && 
                              settings?.target_lat && 
                              settings?.target_lng;
    
    if (needLocationCheck) {
      // 如果用户提供了GPS位置
      if (latitude !== undefined && longitude !== undefined) {
        distance = calculateDistance(
          latitude, 
          longitude, 
          settings.target_lat!, 
          settings.target_lng!
        );
        
        const distanceLimit = settings.max_distance || 1000;
        locationValid = distance <= distanceLimit;
        
        console.log('[CheckIn] 位置校验', { 
          memberId, 
          distance, 
          limit: distanceLimit, 
          valid: locationValid,
          locationEnabled: settings?.location_enabled 
        });
        
        if (!locationValid) {
          return NextResponse.json({ 
            error: `不在签到范围内（距离${distance}米，限制${distanceLimit}米）` 
          }, { status: 400 });
        }
      } 
      // 用户手动确认位置（降级方案）
      else if (userConfirmedLocation) {
        console.log('[CheckIn] 用户确认位置', { memberId, note: '用户手动确认在现场' });
        // 允许签到，记录距离为-1表示用户确认
        distance = -1;
      }
      // 既没有GPS位置也没有用户确认
      else {
        console.log('[CheckIn] 缺少位置信息', { memberId, locationEnabled: settings?.location_enabled });
        return NextResponse.json({ 
          error: '请获取位置或确认在现场以完成签到' 
        }, { status: 400 });
      }
    }

    // 5. 创建签到记录
    const record = store.createCheckInRecord({
      class_id: classId,
      member_id: memberId,
      member_name: member.name,
      status: status as any,
      check_in_time: new Date().toISOString(),
      check_in_type: validType as any,
      note: note || undefined,
      image_url: imageUrl || undefined,
      distance: distance,
      location: latitude && longitude ? { lat: latitude, lng: longitude } : undefined
    });

    // 保存到文件
    saveToFile();

    // 6. 日志
    console.log('[CheckIn] 签到成功', { 
      memberId, 
      date: today, 
      period: validType, 
      status,
      distance,
      userConfirmed: userConfirmedLocation,
      duration: `${Date.now() - startTime}ms`
    });

    return NextResponse.json({ 
      success: true,
      record: {
        id: record.id,
        status: record.status,
        checkInTime: record.check_in_time,
        distance: record.distance
      }
    });
  } catch (error) {
    console.error('签到失败:', error);
    return NextResponse.json({ error: '签到失败' }, { status: 500 });
  }
}

// 删除签到记录（重置今日签到）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const store = getStore();
    
    const count = store.deleteCheckInRecordsByClass(classId, date);

    // 保存到文件
    saveToFile();

    console.log('[CheckIn] 删除签到记录', { classId, date, count });

    return NextResponse.json({ 
      success: true,
      deletedCount: count
    });
  } catch (error) {
    console.error('删除签到记录失败:', error);
    return NextResponse.json({ error: '删除签到记录失败' }, { status: 500 });
  }
}
