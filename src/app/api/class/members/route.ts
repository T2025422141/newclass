/**
 * ============================================================================
 * 文件: src/app/api/class/members/route.ts
 * 目录: 班级成员 API
 * 功能: 
 *   - GET: 获取成员列表
 *   - POST: 批量导入成员
 *   - DELETE: 删除成员（支持单个/批量/全部）
 * 
 * 数据存储: 本地内存存储（重启后数据丢失）
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/storage/local/memory-store';
import { saveToFile } from '@/storage/local/file-store';

// 获取成员列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    const store = getStore();
    
    let members = classId 
      ? store.getMembersByClass(classId)
      : Array.from((store as any).members.values());

    return NextResponse.json({ members });
  } catch (error) {
    console.error('获取成员列表失败:', error);
    return NextResponse.json({ error: '获取成员列表失败' }, { status: 500 });
  }
}

// 批量导入成员
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { names, classId } = body;

    if (!names || !Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ error: '请提供有效的名单' }, { status: 400 });
    }

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const store = getStore();
    
    // 检查班级是否存在
    const classInfo = store.getClass(classId);
    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    
    // 批量创建新成员
    const members = names
      .filter(name => name && name.trim())
      .map(name => store.createMember({
        class_id: classId,
        name: name.trim()
      }));

    // 保存到文件
    saveToFile();

    return NextResponse.json({ 
      success: true, 
      count: members.length,
      members 
    });
  } catch (error) {
    console.error('导入成员失败:', error);
    return NextResponse.json({ error: '导入成员失败' }, { status: 500 });
  }
}

// 删除成员（支持单个删除、批量删除、全部清除）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdFromQuery = searchParams.get('classId');
    const memberId = searchParams.get('memberId');

    // 优先通过请求体获取参数
    let body: { memberIds?: string[]; classId?: string; clearAll?: boolean } = {};
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch (e) {
        console.error('解析请求体失败:', e);
      }
    }

    const store = getStore();
    const targetClassId = body.classId || classIdFromQuery;
    
    // 批量删除指定的成员
    if (body.memberIds && body.memberIds.length > 0) {
      let count = 0;
      body.memberIds.forEach(id => {
        if (store.deleteMember(id)) {
          count++;
        }
      });
      
      // 保存到文件
      saveToFile();
      
      return NextResponse.json({ success: true, count });
    }
    
    // 全部清除
    if (body.clearAll && targetClassId) {
      const count = store.deleteMembersByClass(targetClassId);
      
      // 保存到文件
      saveToFile();
      
      return NextResponse.json({ success: true, count });
    }
    
    // 删除单个成员（通过URL参数）
    if (memberId) {
      const success = store.deleteMember(memberId);
      
      if (!success) {
        return NextResponse.json({ error: '成员不存在' }, { status: 404 });
      }
      
      // 保存到文件
      saveToFile();
      
      return NextResponse.json({ success: true, count: 1 });
    }
    
    // 删除该班级所有成员（通过URL参数）
    if (classIdFromQuery) {
      const count = store.deleteMembersByClass(classIdFromQuery);
      
      // 保存到文件
      saveToFile();
      
      return NextResponse.json({ success: true, count });
    }

    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  } catch (error) {
    console.error('删除成员失败:', error);
    return NextResponse.json({ error: '删除成员失败' }, { status: 500 });
  }
}
