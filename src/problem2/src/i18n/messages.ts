/**
 * `en` is the source of truth: its keys become `MessageKey`, so a misspelled
 * key is a compile error and a missing translation fails the build.
 */
export const en = {
  'nav.price': 'Price',
  'nav.calculator': 'Calculator',
  'nav.main': 'Main',

  'feed.loading': 'Connecting',
  'feed.live': 'Live prices',
  'feed.cached': 'Cached prices',
  'feed.refresh': 'Refresh',

  'theme.toLight': 'Switch to light theme',
  'theme.toDark': 'Switch to dark theme',
  'lang.label': 'Language',

  'rate.pair': '{base} to {quote}',
  'rate.line': '1 {base} = {amount} {quote}',
  'rate.window': 'in the past 24 hrs',
  'rate.simulated': 'simulated',
  'rate.simulatedHint': 'The price feed carries one spot quote per token and no history.',
  'rate.marked': 'Spot quote marked {time}',

  'chart.title': '{base} to {quote} · past 24 hrs',
  'chart.note': 'Simulated series, not market data',
  'chart.latest': 'latest',
  'chart.now': 'now',
  'chart.alt': 'Simulated 24 hour rate for {base} against {quote}, {direction} {percent} percent',
  'chart.up': 'up',
  'chart.down': 'down',

  'calc.title': 'Conversion Calculator',
  'calc.from': 'From',
  'calc.to': 'To',
  'calc.reverse': 'Convert {to} to {from} instead',
  'calc.solvingFrom': 'solving for From',
  'calc.solvingTo': 'solving for To',
  'calc.inverseHint': 'Show the inverse rate',
  'calc.belowPrecision':
    'That is smaller than this calculator shows. Amounts are given to {min} of a unit.',
  'calc.table': '{base} to {quote} conversion table',

  'picker.from': 'Convert from',
  'picker.to': 'Convert to',
  'picker.search': 'Search name or ticker',
  'picker.searchLabel': 'Search assets',
  'picker.count': '{count} assets priced',
  'picker.countOne': '{count} asset priced',
  'picker.flips': 'flips pair',
  'picker.emptyTitle': 'Nothing matches “{query}”.',
  'picker.emptyHint': 'Only assets carrying a price are listed.',
  'picker.browse': 'browse',
  'picker.select': 'select',
  'picker.close': 'close',
  'picker.closeLabel': 'Close',
  'picker.assets': 'Assets',
  'picker.changeAsset': 'Change asset, currently {symbol}',
  'picker.chooseAsset': 'Choose an asset',
  'picker.selectPlaceholder': 'Select',
} as const

export type MessageKey = keyof typeof en

/** Every locale must cover every key, or this fails to compile. */
type Messages = Record<MessageKey, string>

export const vi: Messages = {
  'nav.price': 'Giá',
  'nav.calculator': 'Quy đổi',
  'nav.main': 'Chính',

  'feed.loading': 'Đang kết nối',
  'feed.live': 'Giá trực tiếp',
  'feed.cached': 'Giá đã lưu',
  'feed.refresh': 'Làm mới',

  'theme.toLight': 'Chuyển sang giao diện sáng',
  'theme.toDark': 'Chuyển sang giao diện tối',
  'lang.label': 'Ngôn ngữ',

  'rate.pair': '{base} sang {quote}',
  'rate.line': '1 {base} = {amount} {quote}',
  'rate.window': 'trong 24 giờ qua',
  'rate.simulated': 'mô phỏng',
  'rate.simulatedHint': 'Nguồn giá chỉ có một mức giá tại một thời điểm, không có lịch sử.',
  'rate.marked': 'Giá chốt lúc {time}',

  'chart.title': '{base} sang {quote} · 24 giờ qua',
  'chart.note': 'Chuỗi mô phỏng, không phải dữ liệu thị trường',
  'chart.latest': 'mới nhất',
  'chart.now': 'bây giờ',
  'chart.alt': 'Tỉ giá 24 giờ mô phỏng của {base} so với {quote}, {direction} {percent} phần trăm',
  'chart.up': 'tăng',
  'chart.down': 'giảm',

  'calc.title': 'Công cụ quy đổi',
  'calc.from': 'Từ',
  'calc.to': 'Sang',
  'calc.reverse': 'Đổi chiều: quy đổi {to} sang {from}',
  'calc.solvingFrom': 'đang tính ô Từ',
  'calc.solvingTo': 'đang tính ô Sang',
  'calc.inverseHint': 'Xem tỉ giá ngược',
  'calc.belowPrecision':
    'Kết quả nhỏ hơn mức công cụ này hiển thị được. Số lượng được tính đến {min} đơn vị.',
  'calc.table': 'Bảng quy đổi {base} sang {quote}',

  'picker.from': 'Quy đổi từ',
  'picker.to': 'Quy đổi sang',
  'picker.search': 'Tìm theo tên hoặc mã',
  'picker.searchLabel': 'Tìm tài sản',
  'picker.count': '{count} tài sản có giá',
  'picker.countOne': '{count} tài sản có giá',
  'picker.flips': 'đổi chiều',
  'picker.emptyTitle': 'Không có kết quả cho “{query}”.',
  'picker.emptyHint': 'Chỉ những tài sản có giá mới được liệt kê.',
  'picker.browse': 'duyệt',
  'picker.select': 'chọn',
  'picker.close': 'đóng',
  'picker.closeLabel': 'Đóng',
  'picker.assets': 'Tài sản',
  'picker.changeAsset': 'Đổi tài sản, hiện là {symbol}',
  'picker.chooseAsset': 'Chọn tài sản',
  'picker.selectPlaceholder': 'Chọn',
}

export const LOCALES = {
  en: { label: 'EN', messages: en as Messages, intl: 'en-US' },
  vi: { label: 'VI', messages: vi, intl: 'vi-VN' },
} as const

export type Locale = keyof typeof LOCALES
