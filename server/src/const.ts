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
