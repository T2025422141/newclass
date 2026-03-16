/**
 * ============================================================================
 * 文件: src/app/api/class/settings/route.ts
 * 目录: 签到设置 API
 * 功能: 
 *   - GET: 获取班级签到设置（时间限制、位置信息）
 *   - POST: 更新签到设置
 * 
 * 数据存储: 本地内存存储（重启后数据丢失）
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/storage/local/memory-store';
import { saveToFile } from '@/storage/local/file-store';

// 获取设置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ 
        settings: {
          morning_cutoff_time: '08:30',
          evening_cutoff_time: '18:00',
          target_lat: null,
          target_lng: null,
          max_distance: 1000,
          allow_temp_checkin: true,
          location_enabled: false
        }
      });
    }

    const store = getStore();
    
    const settings = store.getCheckInSetting(classId);

    // 如果没有设置，返回默认值
    const result = settings || {
      morning_cutoff_time: '08:30',
      evening_cutoff_time: '18:00',
      target_lat: null,
      target_lng: null,
      max_distance: 1000,
      allow_temp_checkin: true,
      location_enabled: false
    };

    return NextResponse.json({ settings: result });
  } catch (error) {
    console.error('获取设置失败:', error);
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

// 更新设置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      classId, 
      morningCutoffTime, 
      eveningCutoffTime, 
      targetLat,
      targetLng,
      maxDistance,
      allowTempCheckin,
      locationEnabled // 是否启用定位验证
    } = body;

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const store = getStore();

    // 检查班级是否存在
    const classInfo = store.getClass(classId);
    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    // 更新或创建设置
    const existing = store.getCheckInSetting(classId);
    
    let result;
    if (existing) {
      // 更新
      const updateData: any = {};
      if (morningCutoffTime !== undefined) updateData.morning_cutoff_time = morningCutoffTime;
      if (eveningCutoffTime !== undefined) updateData.evening_cutoff_time = eveningCutoffTime;
      if (targetLat !== undefined) updateData.target_lat = targetLat;
      if (targetLng !== undefined) updateData.target_lng = targetLng;
      if (maxDistance !== undefined) updateData.max_distance = maxDistance;
      if (allowTempCheckin !== undefined) updateData.allow_temp_checkin = allowTempCheckin;
      if (locationEnabled !== undefined) updateData.location_enabled = locationEnabled;
      
      result = store.updateCheckInSetting(classId, updateData);
    } else {
      // 创建
      result = store.createCheckInSetting({
        class_id: classId,
        morning_cutoff_time: morningCutoffTime || '08:30',
        evening_cutoff_time: eveningCutoffTime || '18:00',
        target_lat: targetLat,
        target_lng: targetLng,
        max_distance: maxDistance || 1000,
        allow_temp_checkin: allowTempCheckin !== undefined ? allowTempCheckin : true,
        location_enabled: locationEnabled !== undefined ? locationEnabled : false
      });
    }

    // 保存到文件
    saveToFile();

    return NextResponse.json({ success: true, settings: result });
  } catch (error) {
    console.error('更新设置失败:', error);
    return NextResponse.json({ error: '更新设置失败' }, { status: 500 });
  }
}
