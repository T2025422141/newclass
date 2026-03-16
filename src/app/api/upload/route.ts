/**
 * ============================================================================
 * 文件: src/app/api/upload/route.ts
 * 目录: 文件上传 API
 * 功能: 
 *   - POST: 上传图片到本地文件系统
 *   - 返回可访问的 URL
 * 
 * 数据存储: 本地文件系统（uploads/ 目录）
 * 注意: Vercel 部署时文件不会持久化（需要使用对象存储）
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 上传目录
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'leave-images');

// 确保上传目录存在
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '只能上传图片文件' }, { status: 400 });
    }

    // 检查文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '图片大小不能超过 10MB' }, { status: 400 });
    }

    // 确保上传目录存在
    ensureUploadDir();

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // 写入文件
    fs.writeFileSync(filePath, buffer);

    // 生成访问 URL
    const imageUrl = `/uploads/leave-images/${fileName}`;

    console.log('[Upload] 文件上传成功', { fileName, size: file.size });

    return NextResponse.json({
      success: true,
      key: fileName,
      imageUrl,
    });
  } catch (error) {
    console.error('上传失败:', error);
    return NextResponse.json({ 
      error: '上传失败',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET: 获取上传的文件列表
 */
export async function GET(request: NextRequest) {
  try {
    ensureUploadDir();
    
    const files = fs.readdirSync(UPLOAD_DIR);
    const fileList = files.map(fileName => {
      const filePath = path.join(UPLOAD_DIR, fileName);
      const stats = fs.statSync(filePath);
      
      return {
        name: fileName,
        url: `/uploads/leave-images/${fileName}`,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });

    return NextResponse.json({
      success: true,
      count: fileList.length,
      files: fileList
    });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return NextResponse.json({ 
      error: '获取文件列表失败',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE: 删除上传的文件
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ error: '缺少文件名' }, { status: 400 });
    }

    const filePath = path.join(UPLOAD_DIR, fileName);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 删除文件
    fs.unlinkSync(filePath);

    console.log('[Upload] 文件删除成功', { fileName });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除文件失败:', error);
    return NextResponse.json({ 
      error: '删除文件失败',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
