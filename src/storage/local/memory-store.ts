/**
 * ============================================================================
 * 文件: src/storage/local/memory-store.ts
 * 目录: 本地内存存储
 * 功能: 
 *   - 提供内存存储实现
 *   - 管理签到记录、请假记录、班级成员等数据
 *   - 重启后数据丢失
 * ============================================================================
 */

// 类型定义
export interface CheckInRecord {
  id: string;
  class_id: string;
  member_id: string;
  member_name: string;
  status: string;
  check_in_time: string;
  check_in_type: 'morning' | 'evening' | 'temporary';
  note?: string;
  image_url?: string;
  distance?: number;
  location?: { lat: number; lng: number };
}

export interface LeaveRecord {
  id: string;
  class_id: string;
  member_id: string;
  member_name: string;
  start_date: string;
  end_date: string;
  leave_type: 'range' | 'weekday';
  day_of_week?: number;
  check_in_time: string;
  reason: string;
  image_url?: string;
}

export interface Member {
  id: string;
  name: string;
  class_id: string;
}

export interface CheckInSetting {
  class_id: string;
  location_enabled: boolean;
  target_lat?: number;
  target_lng?: number;
  max_distance?: number;
  morning_cutoff_time?: string;
  evening_cutoff_time?: string;
  allow_temp_checkin?: boolean;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  admin_password: string;
}

class MemoryStore {
  private checkInRecords: CheckInRecord[] = [];
  private leaveRecords: LeaveRecord[] = [];
  private members: Member[] = [];
  private checkInSettings: CheckInSetting[] = [];
  private classes: Class[] = [];

  // 生成唯一ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 签到记录相关方法
  createCheckInRecord(record: Omit<CheckInRecord, 'id'>): CheckInRecord {
    const newRecord: CheckInRecord = {
      ...record,
      id: this.generateId()
    };
    this.checkInRecords.push(newRecord);
    return newRecord;
  }

  getCheckInRecordsByClass(classId: string, date?: string, checkInType?: string): CheckInRecord[] {
    let records = this.checkInRecords.filter(r => r.class_id === classId);
    
    if (date) {
      records = records.filter(r => r.check_in_time.split('T')[0] === date);
    }
    
    if (checkInType) {
      records = records.filter(r => r.check_in_type === checkInType);
    }
    
    return records;
  }

  getCheckInRecordByMember(memberId: string, date: string): CheckInRecord | undefined {
    return this.checkInRecords.find(
      r => r.member_id === memberId && r.check_in_time.split('T')[0] === date
    );
  }

  deleteCheckInRecordsByClass(classId: string, date: string): number {
    const initialLength = this.checkInRecords.length;
    this.checkInRecords = this.checkInRecords.filter(
      r => !(r.class_id === classId && r.check_in_time.split('T')[0] === date)
    );
    return initialLength - this.checkInRecords.length;
  }

  // 成员相关方法
  getMembersByClass(classId: string): Member[] {
    return this.members.filter(m => m.class_id === classId);
  }

  getMember(memberId: string): Member | undefined {
    return this.members.find(m => m.id === memberId);
  }

  // 请假记录相关方法
  createLeaveRecord(record: Omit<LeaveRecord, 'id'>): LeaveRecord {
    const newRecord: LeaveRecord = {
      ...record,
      id: this.generateId()
    };
    this.leaveRecords.push(newRecord);
    return newRecord;
  }

  getLeaveRecordsByClass(classId: string): LeaveRecord[] {
    return this.leaveRecords.filter(r => r.class_id === classId);
  }

  getLeaveRecordByMember(memberId: string): LeaveRecord[] {
    return this.leaveRecords.filter(r => r.member_id === memberId);
  }

  getActiveLeaveRecords(classId: string, date: string, checkInType: 'morning' | 'evening'): LeaveRecord[] {
    const today = new Date(date);
    const dayOfWeek = today.getDay();
    
    return this.leaveRecords.filter(record => {
      if (record.class_id !== classId) return false;
      if (record.check_in_time !== 'all' && record.check_in_time !== checkInType) return false;
      
      if (record.leave_type === 'range') {
        const start = new Date(record.start_date);
        const end = new Date(record.end_date);
        return today >= start && today <= end;
      } else if (record.leave_type === 'weekday' && record.day_of_week !== undefined) {
        return record.day_of_week === dayOfWeek;
      }
      
      return false;
    });
  }

  deleteLeaveRecord(id: string): boolean {
    const initialLength = this.leaveRecords.length;
    this.leaveRecords = this.leaveRecords.filter(r => r.id !== id);
    return initialLength !== this.leaveRecords.length;
  }

  // 签到设置相关方法
  getCheckInSetting(classId: string): CheckInSetting | undefined {
    return this.checkInSettings.find(s => s.class_id === classId);
  }

  createCheckInSetting(setting: CheckInSetting): CheckInSetting {
    this.checkInSettings.push(setting);
    return setting;
  }

  updateCheckInSetting(classId: string, updates: Record<string, any>): CheckInSetting | null {
    const settingIndex = this.checkInSettings.findIndex(s => s.class_id === classId);
    if (settingIndex === -1) {
      return null;
    }

    this.checkInSettings[settingIndex] = {
      ...this.checkInSettings[settingIndex],
      ...updates
    };
    return this.checkInSettings[settingIndex];
  }

  // 班级相关方法
  getClass(classId: string): Class | undefined {
    return this.classes.find(c => c.id === classId);
  }

  // 成员相关方法
  createMember(member: Omit<Member, 'id'>): Member {
    const newMember: Member = {
      ...member,
      id: this.generateId()
    };
    this.members.push(newMember);
    return newMember;
  }

  deleteMember(memberId: string): boolean {
    const initialLength = this.members.length;
    this.members = this.members.filter(m => m.id !== memberId);
    return initialLength !== this.members.length;
  }

  deleteMembersByClass(classId: string): number {
    const initialLength = this.members.length;
    this.members = this.members.filter(m => m.class_id !== classId);
    return initialLength - this.members.length;
  }

  // 班级相关方法
  getAllClasses(): Class[] {
    return this.classes;
  }

  createClass(classData: Omit<Class, 'id' | 'created_at'>): Class {
    const newClass: Class = {
      ...classData,
      id: this.generateId(),
      created_at: new Date().toISOString()
    };
    this.classes.push(newClass);
    return newClass;
  }

  updateClass(classId: string, updates: Record<string, string | undefined>): boolean {
    const classIndex = this.classes.findIndex(c => c.id === classId);
    if (classIndex === -1) {
      return false;
    }

    this.classes[classIndex] = {
      ...this.classes[classIndex],
      ...updates
    };
    return true;
  }

  deleteClass(classId: string): boolean {
    const initialLength = this.classes.length;
    this.classes = this.classes.filter(c => c.id !== classId);
    
    // 同时删除关联的成员
    this.members = this.members.filter(m => m.class_id !== classId);
    
    // 删除关联的签到记录
    this.checkInRecords = this.checkInRecords.filter(r => r.class_id !== classId);
    
    // 删除关联的请假记录
    this.leaveRecords = this.leaveRecords.filter(r => r.class_id !== classId);
    
    // 删除关联的签到设置
    this.checkInSettings = this.checkInSettings.filter(s => s.class_id !== classId);
    
    return initialLength !== this.classes.length;
  }
}

// 单例模式
let store: MemoryStore | null = null;

export function getStore(): MemoryStore {
  if (!store) {
    store = new MemoryStore();
  }
  return store;
}
