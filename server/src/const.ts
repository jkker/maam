export const IMMEDIATE_TASK = ['CaptureImageNow', 'StopTask', 'HeartBeat'] as const

export const TASK_TYPE = [
  ...IMMEDIATE_TASK,
  'CaptureImage',
  'LinkStart',
  'LinkStart-Base',
  'LinkStart-WakeUp',
  'LinkStart-Combat',
  'LinkStart-Recruiting',
  'LinkStart-Mall',
  'LinkStart-Mission',
  'LinkStart-AutoRoguelike',
  'LinkStart-Reclamation',
  'Settings-Stage1',
] as const

export const T = {
  LinkStart: '一键长草',
  'LinkStart-Base': '基地换班',
  'LinkStart-WakeUp': '自动唤醒',
  'LinkStart-Combat': '刷理智',
  'LinkStart-Recruiting': '自动公招',
  'LinkStart-Mall': '获取信用及购物',
  'LinkStart-Mission': '领取奖励',
  'LinkStart-AutoRoguelike': '自动肉鸽',
  'LinkStart-Reclamation': '生息演算',
  CaptureImageNow: '立即截图',
  CaptureImage: '截图',
  StopTask: '停止',
  HeartBeat: '测试链接',
  'Settings-Stage1': '关卡设置',
} as const

export const ARKNIGHTS_TIME_ZONE = 'Asia/Shanghai'

export const DEFAULT_DEVICE = 'bdc57941058a47e6bf56f2a993c87af3'
export const DEFAULT_USER = 'user'
export const MJPEG_BOUNDARY = '--bound' // MJPEG streaming constants

// Stage selection data with availability by weekday
interface StageOption {
  id: string
  label: string
  weekdays?: number[] // 1=Monday, 7=Sunday; empty means all days
}
export const STAGE_OPTIONS: StageOption[] = [
  { id: 'default', label: '当前/上次' },
  // 主线关卡
  { id: '1-7', label: '固源岩' },
  { id: 'R8-11', label: '晶体元件' },
  { id: '12-17-HARD', label: '化合切削液' },
  // 资源本
  { id: 'CE-6', label: '龙门币', weekdays: [2, 4, 6, 7] },
  { id: 'AP-5', label: '红票', weekdays: [1, 4, 6, 7] },
  { id: 'CA-5', label: '技能', weekdays: [2, 3, 5, 7] },
  { id: 'LS-6', label: '经验' },
  { id: 'SK-5', label: '碳', weekdays: [1, 3, 5, 6] },
  // 剿灭模式
  { id: 'Annihilation', label: '剿灭模式' },
  // 芯片本
  { id: 'PR-A-1', label: '奶/盾芯片', weekdays: [1, 4, 5, 7] },
  { id: 'PR-A-2', label: '奶/盾芯片组', weekdays: [1, 4, 5, 7] },
  { id: 'PR-B-1', label: '术/狙芯片', weekdays: [1, 2, 5, 6] },
  { id: 'PR-B-2', label: '术/狙芯片组', weekdays: [1, 2, 5, 6] },
  { id: 'PR-C-1', label: '先/辅芯片', weekdays: [3, 4, 6, 7] },
  { id: 'PR-C-2', label: '先/辅芯片组', weekdays: [3, 4, 6, 7] },
  { id: 'PR-D-1', label: '近/特芯片', weekdays: [2, 3, 6, 7] },
  { id: 'PR-D-2', label: '近/特芯片组', weekdays: [2, 3, 6, 7] },
]
