/**
 * ============================================================================
 * 文件: src/app/api/class/route.ts
 * 目录: 班级管理 API
 * 功能: 
 *   - GET: 获取班级列表或单个班级详情
 *   - POST: 创建新班级
 *   - PUT: 更新班级信息
 *   - DELETE: 删除班级及其关联数据
 * 
 * 数据存储: 本地内存存储（重启后数据丢失）
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/storage/local/memory-store';
import { saveToFile } from '@/storage/local/file-store';

// 获取所有班级列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('id');

    const store = getStore();

    if (classId) {
      // 获取单个班级详情
      const classInfo = store.getClass(classId);
      
      if (!classInfo) {
        return NextResponse.json({ error: '班级不存在' }, { status: 404 });
      }

      // 获取班级成员数量
      const members = store.getMembersByClass(classId);

      return NextResponse.json({
        class: {
          id: classInfo.id,
          name: classInfo.name,
          description: classInfo.description,
          createdAt: classInfo.created_at,
          memberCount: members.length
        }
      });
    }

    // 获取所有班级
    const classes = store.getAllClasses();

    // 获取每个班级的成员数量
    const result = classes.map(cls => {
      const members = store.getMembersByClass(cls.id);
      return {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        createdAt: cls.created_at,
        memberCount: members.length
      };
    });

    return NextResponse.json({ classes: result });
  } catch (error) {
    console.error('获取班级列表失败:', error);
    return NextResponse.json({ error: '获取班级列表失败' }, { status: 500 });
  }
}

// 创建新班级
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, adminPassword } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
    }

    const store = getStore();
    
    const data = store.createClass({
      name: name.trim(),
      description: description?.trim() || undefined,
      admin_password: adminPassword || '123456'
    });

    // 保存到文件
    saveToFile();

    return NextResponse.json({
      success: true,
      class: {
        id: data.id,
        name: data.name,
        description: data.description
      }
    });
  } catch (error) {
    console.error('创建班级失败:', error);
    return NextResponse.json({ error: '创建班级失败' }, { status: 500 });
  }
}

// 更新班级信息
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, adminPassword } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const store = getStore();

    const updateData: Record<string, string | undefined> = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || undefined;
    if (adminPassword) updateData.admin_password = adminPassword;

    const result = store.updateClass(id, updateData);
    
    if (!result) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    // 保存到文件
    saveToFile();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新班级失败:', error);
    return NextResponse.json({ error: '更新班级失败' }, { status: 500 });
  }
}

// 删除班级
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const store = getStore();
    
    // 删除班级及关联数据
    const success = store.deleteClass(id);

    if (!success) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    // 保存到文件
    saveToFile();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除班级失败:', error);
    return NextResponse.json({ error: '删除班级失败' }, { status: 500 });
  }
}
