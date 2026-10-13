import type { BossId } from './bosses';
import type { DivinePowerId } from './skills';

/**
 * Tiện ích đóng băng đệ quy để đảm bảo tính bất biến (deep immutability)
 * cho toàn bộ dữ liệu Content Catalog 1.0.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const propNames = Object.getOwnPropertyNames(obj) as Array<keyof T>;
  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

// ============================================================================
// 1. CHƯƠNG TRÌNH TRUYỆN THẦN THOẠI (4 CHAPTERS)
// ============================================================================

export interface ContentChapter {
  readonly id: number;
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly areaId: string;
  readonly bossId: BossId;
  readonly recommendedLevel: { readonly min: number; readonly max: number };
  readonly divineSynergy: DivinePowerId;
  readonly objective: string;
  readonly narrativeSummary: string;
}

export const CHAPTERS: readonly ContentChapter[] = deepFreeze([
  {
    id: 1,
    key: 'chuong-1',
    title: 'Điềm Dữ Rừng Trúc',
    subtitle: 'Khởi đầu Thiên Mệnh Lạc Việt',
    areaId: 'rung-truc-u-minh',
    bossId: 'ho-yeu',
    recommendedLevel: { min: 1, max: 3 },
    divineSynergy: 'flame',
    objective: 'Thanh tẩy yêu khí chướng ngại và bảo vệ bình yên làng Lạc Thủy trước móng vuốt của Hổ Yêu.',
    narrativeSummary: 'Thiên hạ thái bình ngàn năm bỗng nổi cơn giông gió. Rừng trúc ngút ngàn nhuốm màu chướng khí tà ác, thú dữ biến dị tấn công xóm làng. Hậu duệ Văn Lang nhận lãnh thần binh sơ khởi, bước vào rặng trúc u minh để đối đầu chúa tể ác thú Hổ Yêu U Minh.',
  },
  {
    id: 2,
    key: 'chuong-2',
    title: 'Bóng Đen Đầm Thiêng',
    subtitle: 'Nộ ba cuộn trào đáy nước',
    areaId: 'dam-thieng',
    bossId: 'thuong-luong',
    recommendedLevel: { min: 3, max: 5 },
    divineSynergy: 'water',
    objective: 'Hóa giải hắc ám nguyền chú đang thao túng dòng thủy lưu và giải thoát linh thú Thuồng Luồng.',
    narrativeSummary: 'Mặt nước Đầm Thiêng sục sôi tà độc, sóng dữ dâng cao đe dọa nhấn chìm bờ cõi. Dưới sự dẫn lối của con cháu loài Rồng, dũng sĩ lặn xuống phế tích thủy cung, giải khai xiềng xích oán niệm đang giam giữ Thủy Thần Thuồng Luồng Nhiễm Tà.',
  },
  {
    id: 3,
    key: 'chuong-3',
    title: 'Lời Nguyền Núi Thiêng',
    subtitle: 'Thử thách Bàn Thạch Tản Viên',
    areaId: 'nui-tan-vien',
    bossId: 'thach-tuong',
    recommendedLevel: { min: 5, max: 8 },
    divineSynergy: 'earth',
    objective: 'Leo lên non thiêng Tản Viên, phá bỏ phong ấn tà thuật kích động cơn thịnh nộ của Thạch Tướng Cổ.',
    narrativeSummary: 'Đỉnh núi Ba Vì mây mù che phủ, địa chấn rung chuyển dữ dội. Pho tượng đá hộ vệ ngàn năm bị bùa chú hắc ám đánh thức trong cơn cuồng nộ vô minh. Người thừa kế Thiên Mệnh phải trui rèn ý chí thép để thuần phục sức mạnh Bàn Thạch của Thần Sơn.',
  },
  {
    id: 4,
    key: 'chuong-4',
    title: 'Thiên Mệnh Văn Lang',
    subtitle: 'Hào khí non sông định quốc',
    areaId: 'phong-chau',
    bossId: 'hac-an',
    recommendedLevel: { min: 8, max: 10 },
    divineSynergy: 'flame',
    objective: 'Đột kích cấm địa Phong Châu, tiêu diệt thực thể Hắc Ấn Vô Diện và định đoạt vận mệnh giang sơn.',
    narrativeSummary: 'Mọi cội nguồn tai ương quy tụ về hoàng thành Phong Châu cổ kính. Thực thể hư vô ngưng tụ từ oán khí ngàn năm mưu toan nuốt chửng linh khí Văn Lang. Dưới ánh hào quang Trống Đồng ngời sáng, trận chiến thiên mệnh tối hậu chính thức bùng nổ.',
  },
]);

// ============================================================================
// 2. VÙNG ĐẤT CHÍNH (5 MAIN AREAS)
// ============================================================================

export interface ContentArea {
  readonly id: string;
  readonly name: string;
  readonly vietnameseTitle: string;
  readonly chapterId: number;
  readonly recommendedLevel: { readonly min: number; readonly max: number };
  readonly divineAffinity: DivinePowerId | 'none';
  readonly bossId: BossId | null;
  readonly connectedAreaIds: readonly string[];
  readonly dungeonIds: readonly string[];
  readonly landmarks: readonly string[];
  readonly description: string;
}

export const MAIN_AREAS: readonly ContentArea[] = deepFreeze([
  {
    id: 'lang-lac-thuy',
    name: 'Làng Lạc Thủy',
    vietnameseTitle: 'Cội Nguồn Bình Yên Ven Sông',
    chapterId: 1,
    recommendedLevel: { min: 1, max: 2 },
    divineAffinity: 'none',
    bossId: null,
    connectedAreaIds: ['rung-truc-u-minh'],
    dungeonIds: [],
    landmarks: ['Cây Đa Đầu Làng', 'Lò Rèn Bách Việt', 'Bến Nước Lạc Thủy', 'Đền Thờ Tổ Mẫu'],
    description: 'Ngôi làng trù phú nằm thoai thoải bên triền sông Hồng màu mỡ. Những mái nhà sàn tranh tre nghiêng bóng dưới rặng nhãn cổ thụ, nơi con cháu dòng giống Lạc Hồng an cư lạc nghiệp và gìn giữ ngọn lửa truyền thống Văn Lang ngàn đời.',
  },
  {
    id: 'rung-truc-u-minh',
    name: 'Rừng Trúc U Minh',
    vietnameseTitle: 'Mê Hồn Trúc Lâm Vạn Trượng',
    chapterId: 1,
    recommendedLevel: { min: 1, max: 3 },
    divineAffinity: 'flame',
    bossId: 'ho-yeu',
    connectedAreaIds: ['lang-lac-thuy', 'dam-thieng'],
    dungeonIds: ['dong-am-hon'],
    landmarks: ['Trúc Lâm Cổ Quán', 'Bãi Đá Hổ Phục', 'Suối Tiên U Mịch', 'Bàn Thờ Sơn Thần'],
    description: 'Cánh rừng tre trúc bạt ngàn bao phủ bởi màn sương khói mờ ảo. Khi tà khí xâm chiếm, những thân trúc xanh mướt cọ xát vào nhau phát ra âm thanh ai oán rợn người, ẩn giấu bầy mãnh thú biến dị và tung tích Hổ Yêu U Minh.',
  },
  {
    id: 'dam-thieng',
    name: 'Đầm Thiêng Ba Vì',
    vietnameseTitle: 'Thủy Vực Thần Bí Cổ Xưa',
    chapterId: 2,
    recommendedLevel: { min: 3, max: 5 },
    divineAffinity: 'water',
    bossId: 'thuong-luong',
    connectedAreaIds: ['rung-truc-u-minh', 'nui-tan-vien'],
    dungeonIds: ['thuy-cung-phe-tich'],
    landmarks: ['Đầm Sen Ngũ Sắc', 'Cầu Gỗ Mục', 'Vọng Nguyệt Lâu', 'Cửa Sông Cổ'],
    description: 'Vùng đầm lầy mênh mông sông nước với những đóa sen khổng lồ tỏa hương thơm ngát nhưng ẩn chứa xoáy nước tử thần. Từng là nơi ngự trị của linh tộc Thủy Tề, nay bị ô uế bởi tà niệm khiến sóng ngầm gầm thét không ngừng.',
  },
  {
    id: 'nui-tan-vien',
    name: 'Núi Tản Viên',
    vietnameseTitle: 'Linh Sơn Hộ Quốc Tráng Lệ',
    chapterId: 3,
    recommendedLevel: { min: 5, max: 8 },
    divineAffinity: 'earth',
    bossId: 'thach-tuong',
    connectedAreaIds: ['dam-thieng', 'phong-chau'],
    dungeonIds: [],
    landmarks: ['Cổng Trời Ba Vì', 'Bàn Cờ Tiên', 'Vách Thạch Bích Thần Kê', 'Đỉnh Tản Viên Uy Nghi'],
    description: 'Ngọn linh sơn hùng vĩ chọc thủng tầng mây trắng, nơi Đức Thánh Sơn Tinh ngự trị thuở khai thiên lập địa. Những vách đá dựng đứng sừng sững tựa bàn thạch thử thách mọi bậc anh kiệt trèo đèo lội suối để cầu thần lực hộ quốc.',
  },
  {
    id: 'phong-chau',
    name: 'Hoàng Thành Phong Châu',
    vietnameseTitle: 'Kinh Đô Cổ Văn Lang Bất Diệt',
    chapterId: 4,
    recommendedLevel: { min: 8, max: 10 },
    divineAffinity: 'flame',
    bossId: 'hac-an',
    connectedAreaIds: ['nui-tan-vien'],
    dungeonIds: ['dia-cung-co-loa'],
    landmarks: ['Cổng Thành Nghinh Phong', 'Điện Kính Thiên', 'Quảng Trường Trống Đồng', 'Thâm Cung Hắc Ám'],
    description: 'Trái tim của đất nước Văn Lang với tường thành đá kiên cố và đền đài uy nghiêm chạm khắc hoa văn chim Lạc. Nơi đây đang diễn ra cuộc tử chiến sống còn giữa hào khí nghìn năm dựng nước và hắc ám hư vô muốn nhấn chìm cõi bờ.',
  },
]);

// ============================================================================
// 3. HẦM NGỤC THỬ THÁCH (3 DUNGEONS)
// ============================================================================

export interface ContentDungeon {
  readonly id: string;
  readonly name: string;
  readonly vietnameseTitle: string;
  readonly areaId: string;
  readonly minLevel: number;
  readonly floorCount: number;
  readonly eliteId: string;
  readonly bossId: BossId | null;
  readonly keyDropEnemyId: string;
  readonly rewardItemIds: readonly string[];
  readonly description: string;
}

export const DUNGEONS: readonly ContentDungeon[] = deepFreeze([
  {
    id: 'dong-am-hon',
    name: 'Động Âm Hồn',
    vietnameseTitle: 'Sào Huyệt Mãnh Thú Rừng Trúc',
    areaId: 'rung-truc-u-minh',
    minLevel: 2,
    floorCount: 2,
    eliteId: 'bach-trao-ho-ma',
    bossId: null,
    keyDropEnemyId: 'soi-rung-hac-am',
    rewardItemIds: ['spirit-stone', 'herbal-balm', 'jade-charm'],
    description: 'Hang động ẩm thấp hun hút ăn sâu vào lòng đồi trúc, nơi lũ thú dữ tích tụ tà khí và tôn sùng Bạch Trảo Hổ Ma làm thủ lĩnh hộ vệ cửa vào sào huyệt Hổ Yêu.',
  },
  {
    id: 'thuy-cung-phe-tich',
    name: 'Thủy Cung Phế Tích',
    vietnameseTitle: 'Di Tích Thủy Tộc Đáy Đầm',
    areaId: 'dam-thieng',
    minLevel: 4,
    floorCount: 3,
    eliteId: 'giao-long-thuy-than',
    bossId: null,
    keyDropEnemyId: 'thuy-quai-tam-ngu',
    rewardItemIds: ['bronze-spear', 'spirit-tea', 'spirit-stone'],
    description: 'Tàn tích cung điện dưới nước từ thời Thần Nông chìm sâu dưới bùn lầy, các hành lang ngập nước bị rêu phong phủ kín và bảo vệ nghiêm ngặt bởi Hắc Long Ngư Ma hung hãn.',
  },
  {
    id: 'dia-cung-co-loa',
    name: 'Địa Cung Cổ Loa',
    vietnameseTitle: 'Mê Cung Cơ Quan Dưới Lòng Đất',
    areaId: 'phong-chau',
    minLevel: 8,
    floorCount: 4,
    eliteId: 'am-anh-quy-vuong',
    bossId: null,
    keyDropEnemyId: 'hac-an-ve-si',
    rewardItemIds: ['bamboo-armor', 'bronze-scrap', 'spirit-stone'],
    description: 'Mê cung ngầm nhiều tầng xây dựng bằng đá tảng và cơ quan liên hoàn bảo vệ bảo vật quốc gia, nay trở thành sào huyệt tập trung ma binh của Dạ Xoa U Minh.',
  },
]);

// ============================================================================
// 4. NHÂN VẬT NPC CÓ TÊN (15 NAMED NPCS)
// ============================================================================

export type ContentNpcService = 'quest' | 'smith' | 'healer' | 'shop' | 'lore' | 'skill_trainer';

export interface ContentNpc {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly areaId: string;
  readonly services: readonly ContentNpcService[];
  readonly questIds: readonly string[];
  readonly dialogues: readonly string[];
  readonly lore: string;
}

export const NAMED_NPCS: readonly ContentNpc[] = deepFreeze([
  // 1. Trưởng làng Hùng (Existing ID)
  {
    id: 'village-chief',
    name: 'Trưởng làng Hùng',
    role: 'Người giữ lời thề Văn Lang',
    areaId: 'lang-lac-thuy',
    services: ['quest', 'lore'],
    questIds: ['mq-01-tieng-goi-to-tien', 'mq-03-diet-tru-ho-yeu'],
    dialogues: [
      'Rừng trúc đang dậy yêu khí khôn lường, con hãy cầm lấy ngọn giáo giữ bình an cho xóm làng.',
      'Thiên mệnh của hậu duệ Văn Lang đã định sẵn từ thuở Rồng Tiên mở cõi.',
      'Dù giông bão ngập trời, dòng máu Lạc Hồng không bao giờ cúi đầu khuất phục.',
    ],
    lore: 'Vị bô lão đáng kính thừa hưởng chiếc ấn đồng cổ truyền đời, người trông coi lời thề non nước bảo vệ biên cương của con dân Lạc Thủy.',
  },
  // 2. Thợ rèn Bách Việt (Existing ID)
  {
    id: 'village-smith',
    name: 'Thợ rèn Bách Việt',
    role: 'Bậc thầy luyện đồng và đúc vũ khí',
    areaId: 'lang-lac-thuy',
    services: ['smith', 'shop'],
    questIds: ['sq-02-dong-do-bach-viet'],
    dialogues: [
      'Đồng đỏ đất này phải qua lửa rực ngàn độ mới tôi luyện nên lưỡi sắc chém đá xẻ vàng.',
      'Vũ khí tốt không chỉ sắc bén mà còn phải mang cái tâm kiên định của người cầm kiếm.',
      'Mang thêm mảnh đồng cổ về đây, ta sẽ rèn cho ngươi áo giáp vững như thành đồng.',
    ],
    lore: 'Nghệ nhân đúc đồng trứ danh am hiểu phương pháp nung đồng Đông Sơn bí truyền, có thể cảm nhận linh hồn ẩn trong từng thanh gươm ngọn giáo.',
  },
  // 3. Bà Mo (Existing ID)
  {
    id: 'village-healer',
    name: 'Bà Mo',
    role: 'Người giữ thảo dược và bùa chúc phúc',
    areaId: 'lang-lac-thuy',
    services: ['healer', 'shop'],
    questIds: ['sq-01-thao-duoc-ba-mo'],
    dialogues: [
      'Thiên mệnh còn sáng thì thương tích ắt lành lặn, hãy uống thang thuốc này để dưỡng thần.',
      'Lá cỏ rừng sâu thấm đẫm linh khí trời đất, biết dùng đúng lúc sẽ cứu được mạng người.',
      'Tà khí dù độc hại đến đâu cũng phải quy phục trước ngọn lửa chính khí thuần dương.',
    ],
    lore: 'Bà lão tinh thông dược lý thảo mộc phương Nam, nắm giữ những bài thuốc bí truyền cứu sống bao dân làng thoát khỏi nanh vuốt sơn lam chướng khí.',
  },
  // 4. Ngư Ông Lạc Giang
  {
    id: 'ngu-ong-ba-vi',
    name: 'Ngư Ông Lạc Giang',
    role: 'Lão ngư am hiểu sóng gió sông Hồng',
    areaId: 'lang-lac-thuy',
    services: ['quest', 'lore'],
    questIds: ['mq-04-loi-nguyen-song-nuoc', 'sq-03-nhip-song-song-hong'],
    dialogues: [
      'Cả đời ta xuôi ngược dòng Lạc Thủy, chưa bao giờ thấy sóng dữ ngút trời như dạo này.',
      'Dưới đáy nước sâu có tai mắt của Thủy Tộc, chớ dại dột bơi qua khi chưa hiểu thủy triều.',
      'Thuồng Luồng xưa kia che chở dân chài, nay phát cuồng ắt là do bùa ngải hắc ám.',
    ],
    lore: 'Lão ngư sống trên thuyền bè suốt bảy mươi năm, quen mặt từng ghềnh thác con nước và thấu hiểu tập tính loài thủy quái đầm sâu.',
  },
  // 5. Thợ Săn Sơn Cước
  {
    id: 'tho-san-tan-vien',
    name: 'Thợ Săn Sơn Cước',
    role: 'Thiện xạ thám thính rừng sâu',
    areaId: 'rung-truc-u-minh',
    services: ['quest', 'shop'],
    questIds: ['mq-02-manh-moi-rung-truc', 'sq-05-tieng-hu-dem-trang'],
    dialogues: [
      'Rừng trúc này ta thuộc từng gốc tre, nhưng mấy hôm nay dấu chân thú đã biến dạng thành móng vuốt quỷ dữ.',
      'Muốn săn hổ dữ, trước hết tâm phải tĩnh như mặt hồ không chút gợn sóng.',
      'Cẩn thận phía sau bụi rậm, bầy sói u minh luôn rình rập kẻ sơ hở.',
    ],
    lore: 'Tay thợ săn cừ khôi với cây cung nỏ bách phát bách trúng, người đầu tiên phát hiện dấu vết yêu biến lan rộng từ vùng thâm u.',
  },
  // 6. Đạo Sĩ Trúc Lâm
  {
    id: 'dao-si-truc-lam',
    name: 'Đạo Sĩ Trúc Lâm',
    role: 'Ẩn sĩ nghiên cứu trận pháp phong ấn',
    areaId: 'rung-truc-u-minh',
    services: ['quest', 'skill_trainer'],
    questIds: ['sq-04-tinh-truc-u-minh', 'sq-06-bi-an-dong-am-hon'],
    dialogues: [
      'Cây trúc quân tử đốt thẳng ngàn năm, uốn mà không gãy, chính là biểu tượng của tinh thần bất khuất.',
      'Trận pháp phong ấn trong Động Âm Hồn đã nứt vỡ, cần linh khí thanh khiết để hàn gắn.',
      'Lửa Chu Sa thuần dương chính là khắc tinh chí mạng của tà khí mộc tinh nơi này.',
    ],
    lore: 'Ẩn sĩ tu luyện giữa rừng tre u mịch, thông tuệ âm dương ngũ hành và nắm giữ bí thuật kích phát linh lực tự nhiên bảo vệ cõi bờ.',
  },
  // 7. Thanh Liên Tố Nữ
  {
    id: 'tien-nu-dam-sen',
    name: 'Thanh Liên Tố Nữ',
    role: 'Linh nữ thủ hộ hoa sen đầm thiêng',
    areaId: 'dam-thieng',
    services: ['quest', 'healer'],
    questIds: ['mq-05-bi-mat-thuy-cung', 'sq-07-sen-ngoc-dam-thieng'],
    dialogues: [
      'Sen ngọc nở giữa bùn lầy giữ cho tâm hồn không nhiễm chút bụi trần.',
      'Dưới đáy đầm sâu có di tích Thủy Cung ngàn năm, nơi cất giữ bảo vật của Lạc Long Quân.',
      'Hãy cẩn thận dòng nước xoáy tử thần do lũ thủy yêu tạo ra để nuốt chửng thuyền bè.',
    ],
    lore: 'Linh nữ hóa thân từ đóa sen trắng ngàn năm tuổi giữa Đầm Thiêng, luôn che chở người hiền lương và thanh tẩy nguồn nước bị tà uế.',
  },
  // 8. Lão Nhân Thủy Tộc
  {
    id: 'thuy-toc-lao-nhan',
    name: 'Lão Nhân Thủy Tộc',
    role: 'Sứ giả gìn giữ ký ức Lạc Long',
    areaId: 'dam-thieng',
    services: ['quest', 'lore'],
    questIds: ['mq-06-thanh-tay-thuong-luong', 'sq-09-doc-dia-hoang-loan'],
    dialogues: [
      'Con cháu họ Hồng Bàng mang trong mình một nửa dòng máu Rồng biển cả.',
      'Thuồng Luồng không phải ác thú bẩm sinh, hãy đánh tan tà ấn trên đỉnh đầu nó để trả lại sự thuần khiết.',
      'Nước vừa có thể nâng thuyền lại vừa có thể lật thuyền, hãy dùng sức mạnh Thủy Triều một cách từ tâm.',
    ],
    lore: 'Trưởng lão của bộ tộc cổ sống ven đầm nước, người duy nhất còn nhớ lời giao ước giữa Lạc Long Quân và muôn loài thủy quái thuở xưa.',
  },
  // 9. Thương Nhân Chợ Nổi
  {
    id: 'thuong-nhan-van-lang',
    name: 'Thương Nhân Chợ Nổi',
    role: 'Nhà buôn kỳ trân dị bảo bốn phương',
    areaId: 'dam-thieng',
    services: ['shop', 'quest'],
    questIds: ['sq-08-kho-bau-chim-sau'],
    dialogues: [
      'Ghe thuyền của ta chở ngọc bích từ rừng sâu đến đồng đỏ nơi mỏ quặng xa xôi.',
      'Chỉ cần ngươi có bạc vàng hoặc ngọc bội quý, ta có mọi thứ hỗ trợ cuộc hành trình.',
      'Nghe đồn dưới lòng hồ có rương báu của đoàn thuyền buôn cổ xưa bị đắm chìm.',
    ],
    lore: 'Tay buôn lanh lợi đi khắp các bến bãi sông ngòi xứ Văn Lang, cung cấp đủ loại thảo dược, bùa hộ mệnh và nguyên liệu quý hiếm.',
  },
  // 10. Trưởng Lão Tản Viên
  {
    id: 'tu-si-tan-vien',
    name: 'Trưởng Lão Tản Viên',
    role: 'Tế tự tối cao phụng thờ Sơn Thần',
    areaId: 'nui-tan-vien',
    services: ['quest', 'lore'],
    questIds: ['mq-07-con-duong-len-dinh-thieng', 'mq-09-danh-thuc-thach-tuong'],
    dialogues: [
      'Đỉnh Tản Viên che chở bờ cõi, uy dũng của Đức Thánh Sơn Tinh ngút ngàn vạn dặm.',
      'Đá núi ngàn năm vốn vô tri, nhưng khi thấm nhuần linh khí trời đất sẽ hóa thành hộ vệ vững chãi.',
      'Hãy vượt qua thử thách của Bàn Thạch Thần Sơn để chứng minh tư cách người gánh vác Thiên Mệnh.',
    ],
    lore: 'Vị tu sĩ trông coi đền thờ Sơn Thần trên đỉnh Ba Vì, người kết nối tâm thức với linh khí núi non và thấu hiểu ý nguyện của tiền nhân.',
  },
  // 11. Sơn Cước Dũng Tướng
  {
    id: 'chien-tuong-son-cuoc',
    name: 'Sơn Cước Dũng Tướng',
    role: 'Chỉ huy phòng tuyến non cao',
    areaId: 'nui-tan-vien',
    services: ['quest', 'skill_trainer'],
    questIds: ['mq-08-khao-nghiem-son-tinh', 'sq-12-tieng-gam-rung-nui'],
    dialogues: [
      'Cung tên hay búa chiến trên núi này đều phải nặng tựa nghìn cân mới hạ được quái thú.',
      'Lũ Thạch Hầu hung hãn đã bị tà khí biến thành tay sai đập phá tuyến đèo hiểm trở.',
      'Đứng tấn vững như bàn thạch, xuất chiêu mạnh như núi lở, đó là chân lý võ học Tản Viên.',
    ],
    lore: 'Viên tướng dũng mãnh trấn ải đèo cao hiểm trở, thân hình vạm vỡ như tượng đồng, người huấn luyện các thế đánh khai sơn phá thạch.',
  },
  // 12. Dược Sư Bạch Hạc
  {
    id: 'linh-y-nui-cao',
    name: 'Dược Sư Bạch Hạc',
    role: 'Bậc thầy luyện đan trên vách đá',
    areaId: 'nui-tan-vien',
    services: ['healer', 'shop', 'quest'],
    questIds: ['sq-10-long-vua-thiet-dieu', 'sq-11-tuyet-dinh-hoa-linh'],
    dialogues: [
      'Gió núi lạnh buốt chỉ có thể xua tan bằng chén rượu nếp ngâm rễ sâm ngàn năm.',
      'Lông chim Thiết Điểu và Tuyết Liên trên vách đá là dược liệu vô giá để luyện thể kim cang.',
      'Cơ thể con người là một tiểu vũ trụ, tâm vững thì khí huyết ắt lưu thông điều hòa.',
    ],
    lore: 'Y sư tài ba ẩn dật nơi sườn núi cheo leo bên rừng thông Bạch Hạc, chuyên hái các loài thảo dược mọc trên vách đá cao ngút ngàn.',
  },
  // 13. Tướng Quân Cổ Loa
  {
    id: 'quan-thi-ve-phong-chau',
    name: 'Tướng Quân Cổ Loa',
    role: 'Thống soái cấm vệ quân Phong Châu',
    areaId: 'phong-chau',
    services: ['quest', 'smith'],
    questIds: ['mq-10-phong-chau-khoi-lua', 'sq-13-chiec-no-than-co'],
    dialogues: [
      'Thành lũy Phong Châu không thể thất thủ trước móng vuốt của thực thể hắc ám!',
      'Ta đã lệnh cho cấm quân lập trận thế vây quanh hoàng thành, nhưng yêu ma từ hư không quá đông đảo.',
      'Hãy tìm lại những mũi tên đồng thần bí để tiếp thêm nhuệ khí cho nghĩa quân.',
    ],
    lore: 'Vị tướng oai phong lẫm liệt chỉ huy cấm binh bảo vệ kinh thành, trung kiên bất khuất thề lấy máu xương giữ vững giang sơn cõi Việt.',
  },
  // 14. Đại Tế Tư Lạc Việt
  {
    id: 'te-tu-hoang-cung',
    name: 'Đại Tế Tư Lạc Việt',
    role: 'Người giải mã văn khắc Trống Đồng',
    areaId: 'phong-chau',
    services: ['quest', 'lore'],
    questIds: ['mq-11-dia-cung-phong-an', 'sq-14-van-khac-trong-dong'],
    dialogues: [
      'Hoa văn Mặt Trời trên Trống Đồng chính là linh hồn hộ quốc nghìn năm của nòi giống Tiên Rồng.',
      'Hắc Ấn Vô Diện vốn là cổ ấn tà giáo bị phong ấn dưới Địa Cung Cổ Loa từ ngàn năm trước.',
      'Chỉ có ngọn lửa chính khí kết hợp cùng thần lực trời đất mới thiêu rụi được thực thể hư vô.',
    ],
    lore: 'Học giả uyên thâm trông coi thư tịch cổ và các nghi lễ tế trời đất, người nắm giữ chìa khóa phá giải cổ tự bí truyền trên mặt Trống Đồng Đông Sơn.',
  },
  // 15. Kỵ Sĩ Thần Châu
  {
    id: 'ky-nhan-khong-lo',
    name: 'Kỵ Sĩ Thần Châu',
    role: 'Sứ giả Thiên Mệnh hộ quốc',
    areaId: 'phong-chau',
    services: ['quest', 'lore'],
    questIds: ['mq-12-thien-menh-van-lang', 'sq-15-linh-hon-ho-ve'],
    dialogues: [
      'Thời khắc định đoạt đã điểm! Con đường chông gai này chính là để tôi luyện ngươi thành vị anh hùng cứu quốc.',
      'Tiếng trống trận giục giã bên tai, hồn thiêng sông núi đang dõi theo từng bước chân ngươi.',
      'Hãy vung thanh kiếm thần, giương ngọn giáo thiêng quét sạch bóng tối khỏi bờ cõi Văn Lang!',
    ],
    lore: 'Dũng tướng bí ẩn khoác chiến bào thêu hình chim Lạc vút bay, tương truyền là sứ thần giáng trần để dẫn lối người mang Thiên Mệnh hoàn thành đại nghiệp.',
  },
]);

// ============================================================================
// 5. QUÁI VẬT THÔNG THƯỜNG (12 COMMON ENEMIES)
// ============================================================================

export interface ContentEnemy {
  readonly id: string;
  readonly name: string;
  readonly vietnameseTitle: string;
  readonly areaId: string;
  readonly level: number;
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly element: 'earth' | 'flame' | 'water' | 'physical';
  readonly weakness: 'earth' | 'flame' | 'water' | 'physical';
  readonly dropItemIds: readonly string[];
  readonly xpReward: number;
  readonly goldReward: number;
  readonly description: string;
}

export const COMMON_ENEMIES: readonly ContentEnemy[] = deepFreeze([
  // 1. Mộc Tinh Ấu Thể (Rừng Trúc)
  {
    id: 'moc-tinh-con',
    name: 'Mộc Tinh Ấu Thể',
    vietnameseTitle: 'Yêu Thảo Biến Dị Rừng Trúc',
    areaId: 'rung-truc-u-minh',
    level: 1,
    hp: 45,
    attack: 8,
    defense: 2,
    speed: 65,
    element: 'earth',
    weakness: 'flame',
    dropItemIds: ['herbal-balm', 'spirit-stone'],
    xpReward: 14,
    goldReward: 8,
    description: 'Chồi tre ngàn năm hấp thụ chướng khí mọc thành hình nhân di động, rễ cây sắc nhọn dùng để quất mạnh vào kẻ xâm nhập.',
  },
  // 2. Ma Trơi U Ám (Rừng Trúc)
  {
    id: 'ma-troi-u-am',
    name: 'Ma Trơi U Ám',
    vietnameseTitle: 'Hồn Lửa Lập Lòe Ven Đầm',
    areaId: 'rung-truc-u-minh',
    level: 1,
    hp: 32,
    attack: 7,
    defense: 1,
    speed: 88,
    element: 'flame',
    weakness: 'water',
    dropItemIds: ['spirit-stone'],
    xpReward: 12,
    goldReward: 6,
    description: 'Đốm lửa lân tinh mang oán khí lơ lửng trong đêm tối, lao vào tự bộc phát nhiệt lượng gây bỏng rát cho người đi đường.',
  },
  // 3. Hắc Lang Nanh Dài (Rừng Trúc)
  {
    id: 'soi-rung-hac-am',
    name: 'Hắc Lang Nanh Dài',
    vietnameseTitle: 'Mãnh Thú Săn Mồi Đêm Tối',
    areaId: 'rung-truc-u-minh',
    level: 2,
    hp: 60,
    attack: 11,
    defense: 3,
    speed: 82,
    element: 'physical',
    weakness: 'flame',
    dropItemIds: ['spirit-stone', 'bronze-scrap'],
    xpReward: 18,
    goldReward: 10,
    description: 'Bầy sói hoang nhiễm phải tà khí của Hổ Yêu, mắt đỏ ngầu răng nanh dài nhọn hoắt phối hợp săn mồi cực kỳ tàn bạo.',
  },
  // 4. Độc Xà Trúc Diệp (Rừng Trúc)
  {
    id: 'dia-yeu-canh-truc',
    name: 'Độc Xà Trúc Diệp',
    vietnameseTitle: 'Rắn Lục Ngụy Trang Ngọn Trúc',
    areaId: 'rung-truc-u-minh',
    level: 2,
    hp: 42,
    attack: 13,
    defense: 2,
    speed: 74,
    element: 'earth',
    weakness: 'flame',
    dropItemIds: ['herbal-balm'],
    xpReward: 16,
    goldReward: 9,
    description: 'Rắn lục độc thân mình xanh biếc ẩn nấp hoàn hảo giữa lá tre, phóng xuống bất ngờ găm nọc độc gây suy yếu tức thì.',
  },
  // 5. Quái Ngư Đầm Bùn (Đầm Thiêng)
  {
    id: 'thuy-quai-tam-ngu',
    name: 'Quái Ngư Đầm Bùn',
    vietnameseTitle: 'Cá Dữ Răng Nhọn Đáy Nước',
    areaId: 'dam-thieng',
    level: 3,
    hp: 75,
    attack: 14,
    defense: 4,
    speed: 70,
    element: 'water',
    weakness: 'earth',
    dropItemIds: ['spirit-stone', 'spirit-tea'],
    xpReward: 22,
    goldReward: 13,
    description: 'Loài cá nước ngọt khổng lồ biến dị mang hàm răng sắc nhọn như dao cạo, trồi lên từ bùn lầy đớp xé con mồi.',
  },
  // 6. Thủy Đỉa Cự Yêu (Đầm Thiêng)
  {
    id: 'dia-dia-khong-lo',
    name: 'Thủy Đỉa Cự Yêu',
    vietnameseTitle: 'Ác Thú Hút Máu Đầm Lầy',
    areaId: 'dam-thieng',
    level: 3,
    hp: 85,
    attack: 12,
    defense: 5,
    speed: 55,
    element: 'water',
    weakness: 'flame',
    dropItemIds: ['herbal-balm'],
    xpReward: 24,
    goldReward: 14,
    description: 'Con đỉa khổng lồ trơn nhớt sống trong vùng nước đọng, có khả năng bám chặt hút cạn sinh lực đối thủ nếu không bị thiêu đốt.',
  },
  // 7. Bọ Cạp Bùn Đen (Đầm Thiêng)
  {
    id: 'bo-cap-dam-lay',
    name: 'Bọ Cạp Bùn Đen',
    vietnameseTitle: 'Độc Hạt Ẩn Nấp Dưới Rong Rêu',
    areaId: 'dam-thieng',
    level: 4,
    hp: 92,
    attack: 16,
    defense: 6,
    speed: 62,
    element: 'earth',
    weakness: 'water',
    dropItemIds: ['spirit-stone', 'bronze-scrap'],
    xpReward: 28,
    goldReward: 17,
    description: 'Bọ cạp mang lớp mai đen bóng cứng như thép, đôi càng kẹp chặt và ngòi đuôi chứa kịch độc gây tê liệt toàn thân.',
  },
  // 8. Thạch Hầu Cuồng Bạo (Núi Tản Viên)
  {
    id: 'thach-hau-cuong-bao',
    name: 'Thạch Hầu Cuồng Bạo',
    vietnameseTitle: 'Khỉ Đá Man Dại Rừng Sơn Trà',
    areaId: 'nui-tan-vien',
    level: 5,
    hp: 120,
    attack: 19,
    defense: 7,
    speed: 84,
    element: 'earth',
    weakness: 'water',
    dropItemIds: ['spirit-tea', 'spirit-stone'],
    xpReward: 34,
    goldReward: 20,
    description: 'Đàn khỉ sống trên vách đá Tản Viên bị nhiễm tà khí, cơ bắp cuồn cuộn ném đá tảng và lao vào cào xé hung hãn.',
  },
  // 9. Thiết Điểu Ưng Phong (Núi Tản Viên)
  {
    id: 'dieu-sat-tan-vien',
    name: 'Thiết Điểu Ưng Phong',
    vietnameseTitle: 'Chim Sắt Lượn Quanh Đỉnh Non',
    areaId: 'nui-tan-vien',
    level: 6,
    hp: 110,
    attack: 22,
    defense: 6,
    speed: 92,
    element: 'physical',
    weakness: 'flame',
    dropItemIds: ['bronze-scrap', 'jade-charm'],
    xpReward: 38,
    goldReward: 24,
    description: 'Loài chim ưng cổ xưa có lông vũ cứng và sắc như phi tiêu đồng, lao xuống từ tầng mây với tốc độ kinh hoàng xé toạc con mồi.',
  },
  // 10. Cổ Thạch Hồn Binh (Núi Tản Viên)
  {
    id: 'thach-binh-co',
    name: 'Cổ Thạch Hồn Binh',
    vietnameseTitle: 'Tượng Binh Hóa Đá Tỉnh Giấc',
    areaId: 'nui-tan-vien',
    level: 7,
    hp: 160,
    attack: 24,
    defense: 10,
    speed: 48,
    element: 'earth',
    weakness: 'water',
    dropItemIds: ['bamboo-armor', 'spirit-stone'],
    xpReward: 46,
    goldReward: 28,
    description: 'Các bức tượng chiến binh bằng đá cổ xưa bị tà phù khống chế tự động cử động, mang theo chùy đá nặng nề đập nát mọi chướng ngại.',
  },
  // 11. Hắc Vệ Ma Tăng (Phong Châu)
  {
    id: 'hac-an-ve-si',
    name: 'Hắc Vệ Ma Tăng',
    vietnameseTitle: 'Hộ Vệ Hắc Ám Cấm Địa',
    areaId: 'phong-chau',
    level: 8,
    hp: 185,
    attack: 28,
    defense: 9,
    speed: 76,
    element: 'physical',
    weakness: 'flame',
    dropItemIds: ['bronze-scrap', 'spirit-tea'],
    xpReward: 54,
    goldReward: 32,
    description: 'Những chiến binh sa ngã bị Hắc Ấn tước đoạt linh hồn, cầm đại đao sắc lạnh tuần tra nghiêm ngặt quanh tường thành Phong Châu.',
  },
  // 12. Vô Ảnh Cung Thủ (Phong Châu)
  {
    id: 'u-linh-cung-thu',
    name: 'Vô Ảnh Cung Thủ',
    vietnameseTitle: 'Thiện Xạ Bóng Ma Thành Cổ',
    areaId: 'phong-chau',
    level: 9,
    hp: 145,
    attack: 31,
    defense: 7,
    speed: 86,
    element: 'physical',
    weakness: 'earth',
    dropItemIds: ['bronze-spear', 'spirit-stone'],
    xpReward: 58,
    goldReward: 36,
    description: 'Xạ thủ thoắt ẩn thoắt hiện trong bóng tối hoàng thành, bắn ra những mũi tên mang độc tố hư không xuyên thủng giáp trụ.',
  },
]);

// ============================================================================
// 6. THỦ LĨNH TINH ANH (4 ELITES)
// ============================================================================

export interface ContentElite {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly areaId: string;
  readonly dungeonId: string | null;
  readonly level: number;
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly element: 'earth' | 'flame' | 'water' | 'physical';
  readonly specialMechanic: string;
  readonly associatedBossId: BossId;
  readonly dropItemIds: readonly string[];
  readonly xpReward: number;
  readonly goldReward: number;
  readonly lore: string;
}

export const ELITES: readonly ContentElite[] = deepFreeze([
  // 1. Bạch Trảo Hổ Ma (Rừng Trúc / Động Âm Hồn)
  {
    id: 'bach-trao-ho-ma',
    name: 'Bạch Trảo Hổ Ma',
    title: 'Hộ Pháp Nanh Trắng Rừng Trúc',
    areaId: 'rung-truc-u-minh',
    dungeonId: 'dong-am-hon',
    level: 3,
    hp: 210,
    attack: 18,
    defense: 4,
    speed: 78,
    element: 'physical',
    specialMechanic: 'Vồ mồi liên hoàn ba nhịp và tiếng gầm làm chậm đối thủ.',
    associatedBossId: 'ho-yeu',
    dropItemIds: ['jade-charm', 'spirit-stone'],
    xpReward: 70,
    goldReward: 45,
    lore: 'Mãnh thú nanh trắng phục tùng dưới trướng Hổ Yêu U Minh, trấn thủ cửa vào Động Âm Hồn ngăn chặn bất kỳ ai muốn tiếp cận chúa tể rừng già.',
  },
  // 2. Hắc Long Ngư Ma (Đầm Thiêng / Thủy Cung Phế Tích)
  {
    id: 'giao-long-thuy-than',
    name: 'Hắc Long Ngư Ma',
    title: 'Ác Bá Đáy Đầm Thiêng',
    areaId: 'dam-thieng',
    dungeonId: 'thuy-cung-phe-tich',
    level: 5,
    hp: 290,
    attack: 22,
    defense: 6,
    speed: 68,
    element: 'water',
    specialMechanic: 'Xoáy nước cuộn hút con mồi và phun tia thủy lôi liên thanh.',
    associatedBossId: 'thuong-luong',
    dropItemIds: ['bronze-spear', 'spirit-tea'],
    xpReward: 110,
    goldReward: 65,
    lore: 'Thủy quái khổng lồ nửa rồng nửa cá ngự trị trong phế tích thủy cung, được ban tà lực từ Thuồng Luồng để canh giữ nguồn nước linh thiêng.',
  },
  // 3. Thiết Giáp Ngưu Tướng (Núi Tản Viên)
  {
    id: 'thach-giap-nguu-ma',
    name: 'Thiết Giáp Ngưu Tướng',
    title: 'Cự Thú Bàn Thạch Trấn Ải',
    areaId: 'nui-tan-vien',
    dungeonId: null,
    level: 7,
    hp: 380,
    attack: 26,
    defense: 9,
    speed: 58,
    element: 'earth',
    specialMechanic: 'Ủi thiết giáp chấn động làm nứt mặt đất và phản chấn 10% sát thương.',
    associatedBossId: 'thach-tuong',
    dropItemIds: ['bamboo-armor', 'bronze-scrap'],
    xpReward: 150,
    goldReward: 85,
    lore: 'Trâu sắt khổng lồ mình mang giáp đá do chính Thạch Tướng triệu hồi từ thạch bàn Tản Viên, chuyên húc vỡ mọi vũ khí của kẻ dám leo núi thiêng.',
  },
  // 4. Dạ Xoa U Minh (Phong Châu / Địa Cung Cổ Loa)
  {
    id: 'am-anh-quy-vuong',
    name: 'Dạ Xoa U Minh',
    title: 'Đao Thần Hắc Ảnh Hoàng Thành',
    areaId: 'phong-chau',
    dungeonId: 'dia-cung-co-loa',
    level: 9,
    hp: 460,
    attack: 32,
    defense: 8,
    speed: 82,
    element: 'physical',
    specialMechanic: 'Phân thân bóng ma và thiểm kích tốc biến gây choáng.',
    associatedBossId: 'hac-an',
    dropItemIds: ['jade-charm', 'spirit-stone'],
    xpReward: 200,
    goldReward: 110,
    lore: 'Phó tướng đắc lực nhất của Hắc Ấn Vô Diện, thao túng bóng đêm tại Địa Cung Cổ Loa và sẵn sàng trảm sát bất kỳ kẻ nào mon men đến cấm điện.',
  },
]);

// ============================================================================
// 7. NHIỆM VỤ CHÍNH TUYẾN (12 MAIN QUESTS)
// ============================================================================

export interface ContentQuestObjective {
  readonly id: string;
  readonly description: string;
  readonly kind: 'kill' | 'flag' | 'collect' | 'talk';
  readonly targetId: string;
  readonly requiredCount: number;
}

export interface ContentQuestReward {
  readonly gold: number;
  readonly xp: number;
  readonly items: readonly { readonly itemId: string; readonly quantity: number }[];
  readonly unlockedSkillId?: string;
}

export interface ContentQuest {
  readonly id: string;
  readonly title: string;
  readonly kind: 'main' | 'side';
  readonly chapterId: number;
  readonly areaId: string;
  readonly giverNpcId: string;
  readonly turnInNpcId: string;
  readonly requiredLevel: number;
  readonly prerequisiteQuestId?: string;
  readonly description: string;
  readonly objectives: readonly ContentQuestObjective[];
  readonly reward: ContentQuestReward;
}

export const MAIN_QUESTS: readonly ContentQuest[] = deepFreeze([
  // --- CHƯƠNG 1 (3 MAIN QUESTS) ---
  {
    id: 'mq-01-tieng-goi-to-tien',
    title: 'Tiếng Gọi Tổ Tiên',
    kind: 'main',
    chapterId: 1,
    areaId: 'lang-lac-thuy',
    giverNpcId: 'village-chief',
    turnInNpcId: 'village-chief',
    requiredLevel: 1,
    description: 'Gặp gỡ Trưởng làng Hùng tại làng Lạc Thủy để nhận giáo đồng sơ cấp và lắng nghe lời tiên tri về Thiên Mệnh phục hưng non sông.',
    objectives: [
      { id: 'talk-chief', description: 'Trò chuyện cùng Trưởng làng Hùng bên đền thờ Tổ Mẫu', kind: 'talk', targetId: 'village-chief', requiredCount: 1 },
      { id: 'prepare-spear', description: 'Nhận Giáo đồng Văn Lang từ thợ rèn', kind: 'flag', targetId: 'bronze-spear', requiredCount: 1 },
    ],
    reward: { gold: 50, xp: 80, items: [{ itemId: 'herbal-balm', quantity: 3 }] },
  },
  {
    id: 'mq-02-manh-moi-rung-truc',
    title: 'Manh Mối Rừng Trúc',
    kind: 'main',
    chapterId: 1,
    areaId: 'rung-truc-u-minh',
    giverNpcId: 'tho-san-tan-vien',
    turnInNpcId: 'tho-san-tan-vien',
    requiredLevel: 2,
    prerequisiteQuestId: 'mq-01-tieng-goi-to-tien',
    description: 'Tiến vào Rừng Trúc U Minh tiêu diệt lũ Mộc Tinh Ấu Thể và thu thập vết tích móng vuốt của Hổ Yêu U Minh.',
    objectives: [
      { id: 'hunt-moc-tinh', description: 'Tiêu diệt Mộc Tinh Ấu Thể quấy nhiễu lối vào rừng', kind: 'kill', targetId: 'moc-tinh-con', requiredCount: 5 },
      { id: 'collect-claw-mark', description: 'Thu thập vết cào móng hổ trên thân tre cổ thụ', kind: 'collect', targetId: 'spirit-stone', requiredCount: 2 },
    ],
    reward: { gold: 80, xp: 120, items: [{ itemId: 'spirit-stone', quantity: 2 }] },
  },
  {
    id: 'mq-03-diet-tru-ho-yeu',
    title: 'Diệt Trừ Hổ Yêu',
    kind: 'main',
    chapterId: 1,
    areaId: 'rung-truc-u-minh',
    giverNpcId: 'village-chief',
    turnInNpcId: 'village-chief',
    requiredLevel: 3,
    prerequisiteQuestId: 'mq-02-manh-moi-rung-truc',
    description: 'Thâm nhập trung tâm Rừng Trúc U Minh đối đầu mãnh thú Hổ Yêu U Minh để thanh tẩy chướng khí và mở đường đến Đầm Thiêng.',
    objectives: [
      { id: 'defeat-ho-yeu', description: 'Hạ gục Hổ Yêu U Minh', kind: 'kill', targetId: 'ho-yeu', requiredCount: 1 },
    ],
    reward: { gold: 120, xp: 180, items: [{ itemId: 'jade-charm', quantity: 1 }], unlockedSkillId: 'flame-beam' },
  },

  // --- CHƯƠNG 2 (3 MAIN QUESTS) ---
  {
    id: 'mq-04-loi-nguyen-song-nuoc',
    title: 'Lời Nguyền Sông Nước',
    kind: 'main',
    chapterId: 2,
    areaId: 'dam-thieng',
    giverNpcId: 'ngu-ong-ba-vi',
    turnInNpcId: 'tien-nu-dam-sen',
    requiredLevel: 3,
    prerequisiteQuestId: 'mq-03-diet-tru-ho-yeu',
    description: 'Vượt qua ranh giới Rừng Trúc để đến Đầm Thiêng, tìm kiếm Thanh Liên Tố Nữ và điều tra nguyên nhân sóng ngầm dâng cao bất thường.',
    objectives: [
      { id: 'reach-dam-thieng', description: 'Gặp gỡ Thanh Liên Tố Nữ tại Đầm Sen Ngũ Sắc', kind: 'talk', targetId: 'tien-nu-dam-sen', requiredCount: 1 },
      { id: 'hunt-tam-ngu', description: 'Tiêu diệt Quái Ngư Đầm Bùn chặn đường nước', kind: 'kill', targetId: 'thuy-quai-tam-ngu', requiredCount: 6 },
    ],
    reward: { gold: 100, xp: 160, items: [{ itemId: 'spirit-tea', quantity: 3 }] },
  },
  {
    id: 'mq-05-bi-mat-thuy-cung',
    title: 'Bí Mật Thủy Cung Phế Tích',
    kind: 'main',
    chapterId: 2,
    areaId: 'dam-thieng',
    giverNpcId: 'tien-nu-dam-sen',
    turnInNpcId: 'thuy-toc-lao-nhan',
    requiredLevel: 4,
    prerequisiteQuestId: 'mq-04-loi-nguyen-song-nuoc',
    description: 'Lặn xuống Thủy Cung Phế Tích dưới đáy hồ, đánh bại Hắc Long Ngư Ma để tìm ngọc ấn hóa giải ma chú khống chế thủy thú.',
    objectives: [
      { id: 'defeat-giao-long', description: 'Đánh bại Hắc Long Ngư Ma trong Thủy Cung', kind: 'kill', targetId: 'giao-long-thuy-than', requiredCount: 1 },
      { id: 'find-water-seal', description: 'Giao nộp phong ấn thủy tộc cho Lão Nhân Thủy Tộc', kind: 'talk', targetId: 'thuy-toc-lao-nhan', requiredCount: 1 },
    ],
    reward: { gold: 140, xp: 220, items: [{ itemId: 'spirit-stone', quantity: 4 }] },
  },
  {
    id: 'mq-06-thanh-tay-thuong-luong',
    title: 'Thanh Tẩy Thuồng Luồng',
    kind: 'main',
    chapterId: 2,
    areaId: 'dam-thieng',
    giverNpcId: 'thuy-toc-lao-nhan',
    turnInNpcId: 'village-chief',
    requiredLevel: 5,
    prerequisiteQuestId: 'mq-05-bi-mat-thuy-cung',
    description: 'Tiến thẳng vào tâm bão Đầm Thiêng, khuất phục Thuồng Luồng Nhiễm Tà và trả lại sự trong lành cho nguồn nước linh thiêng.',
    objectives: [
      { id: 'defeat-thuong-luong', description: 'Đánh bại Thuồng Luồng Nhiễm Tà', kind: 'kill', targetId: 'thuong-luong', requiredCount: 1 },
    ],
    reward: { gold: 180, xp: 260, items: [{ itemId: 'bronze-spear', quantity: 1 }], unlockedSkillId: 'tidal-surge' },
  },

  // --- CHƯƠNG 3 (3 MAIN QUESTS) ---
  {
    id: 'mq-07-con-duong-len-dinh-thieng',
    title: 'Con Đường Lên Đỉnh Thiêng',
    kind: 'main',
    chapterId: 3,
    areaId: 'nui-tan-vien',
    giverNpcId: 'tu-si-tan-vien',
    turnInNpcId: 'tu-si-tan-vien',
    requiredLevel: 5,
    prerequisiteQuestId: 'mq-06-thanh-tay-thuong-luong',
    description: 'Đặt chân lên triền dốc Núi Tản Viên, quét sạch bầy Thạch Hầu Cuồng Bạo quấy phá bậc đá lên đền thượng.',
    objectives: [
      { id: 'clear-monkeys', description: 'Đẩy lui bầy Thạch Hầu Cuồng Bạo trên vách đá', kind: 'kill', targetId: 'thach-hau-cuong-bao', requiredCount: 7 },
      { id: 'ring-bell', description: 'Khai mở chuông đồng Sơn Thần tại Cổng Trời Ba Vì', kind: 'flag', targetId: 'tu-si-tan-vien', requiredCount: 1 },
    ],
    reward: { gold: 150, xp: 240, items: [{ itemId: 'spirit-stone', quantity: 5 }] },
  },
  {
    id: 'mq-08-khao-nghiem-son-tinh',
    title: 'Khảo Nghiệm Sơn Tinh',
    kind: 'main',
    chapterId: 3,
    areaId: 'nui-tan-vien',
    giverNpcId: 'chien-tuong-son-cuoc',
    turnInNpcId: 'chien-tuong-son-cuoc',
    requiredLevel: 6,
    prerequisiteQuestId: 'mq-07-con-duong-len-dinh-thieng',
    description: 'Chấp nhận thử thách của dũng tướng Tản Viên, đánh bại Thiết Giáp Ngưu Tướng để chứng minh dũng khí bàn thạch.',
    objectives: [
      { id: 'defeat-nguu-ma', description: 'Hạ gục Thiết Giáp Ngưu Tướng trấn ải', kind: 'kill', targetId: 'thach-giap-nguu-ma', requiredCount: 1 },
      { id: 'hunt-iron-birds', description: 'Bắn hạ Thiết Điểu Ưng Phong quấy nhiễu bầu trời', kind: 'kill', targetId: 'dieu-sat-tan-vien', requiredCount: 4 },
    ],
    reward: { gold: 200, xp: 300, items: [{ itemId: 'bamboo-armor', quantity: 1 }] },
  },
  {
    id: 'mq-09-danh-thuc-thach-tuong',
    title: 'Đánh Thức Thạch Tướng',
    kind: 'main',
    chapterId: 3,
    areaId: 'nui-tan-vien',
    giverNpcId: 'tu-si-tan-vien',
    turnInNpcId: 'quan-thi-ve-phong-chau',
    requiredLevel: 7,
    prerequisiteQuestId: 'mq-08-khao-nghiem-son-tinh',
    description: 'Quyết chiến với Thạch Tướng Bị Nguyền trên đỉnh mây Tản Viên, phá tan bùa chú hắc ám giam cầm hộ thần non sông.',
    objectives: [
      { id: 'defeat-thach-tuong', description: 'Đánh bại Thạch Tướng Bị Nguyền', kind: 'kill', targetId: 'thach-tuong', requiredCount: 1 },
    ],
    reward: { gold: 250, xp: 380, items: [{ itemId: 'bronze-scrap', quantity: 5 }], unlockedSkillId: 'earth-shockwave' },
  },

  // --- CHƯƠNG 4 (3 MAIN QUESTS) ---
  {
    id: 'mq-10-phong-chau-khoi-lua',
    title: 'Phong Châu Khói Lửa',
    kind: 'main',
    chapterId: 4,
    areaId: 'phong-chau',
    giverNpcId: 'quan-thi-ve-phong-chau',
    turnInNpcId: 'te-tu-hoang-cung',
    requiredLevel: 8,
    prerequisiteQuestId: 'mq-09-danh-thuc-thach-tuong',
    description: 'Hành quân về kinh đô Phong Châu đang bị tà binh bao vây, dẹp tan lũ Hắc Vệ Ma Tăng bảo vệ cổng thành Nghinh Phong.',
    objectives: [
      { id: 'defeat-void-guards', description: 'Tiêu diệt Hắc Vệ Ma Tăng trước cổng thành', kind: 'kill', targetId: 'hac-an-ve-si', requiredCount: 8 },
      { id: 'report-priest', description: 'Hội kiến Đại Tế Tư Lạc Việt tại Quảng Trường Trống Đồng', kind: 'talk', targetId: 'te-tu-hoang-cung', requiredCount: 1 },
    ],
    reward: { gold: 220, xp: 360, items: [{ itemId: 'spirit-tea', quantity: 4 }] },
  },
  {
    id: 'mq-11-dia-cung-phong-an',
    title: 'Địa Cung Phong Ấn',
    kind: 'main',
    chapterId: 4,
    areaId: 'phong-chau',
    giverNpcId: 'te-tu-hoang-cung',
    turnInNpcId: 'ky-nhan-khong-lo',
    requiredLevel: 9,
    prerequisiteQuestId: 'mq-10-phong-chau-khoi-lua',
    description: 'Đột kích vào Địa Cung Cổ Loa, tiêu diệt Dạ Xoa U Minh để thu hồi mảnh bùa thiêng mở lối vào Thâm Cung Hắc Ám.',
    objectives: [
      { id: 'defeat-da-xoa', description: 'Hạ gục Dạ Xoa U Minh trong Địa Cung', kind: 'kill', targetId: 'am-anh-quy-vuong', requiredCount: 1 },
      { id: 'meet-giant-knight', description: 'Hội ngộ Kỵ Sĩ Thần Châu trước cửa ải quyết tử', kind: 'talk', targetId: 'ky-nhan-khong-lo', requiredCount: 1 },
    ],
    reward: { gold: 280, xp: 450, items: [{ itemId: 'spirit-stone', quantity: 6 }] },
  },
  {
    id: 'mq-12-thien-menh-van-lang',
    title: 'Thiên Mệnh Văn Lang',
    kind: 'main',
    chapterId: 4,
    areaId: 'phong-chau',
    giverNpcId: 'ky-nhan-khong-lo',
    turnInNpcId: 'village-chief',
    requiredLevel: 10,
    prerequisiteQuestId: 'mq-11-dia-cung-phong-an',
    description: 'Bước vào trận chiến thiên định với Hắc Ấn Vô Diện, cứu rỗi giang sơn Văn Lang và hoàn thành trọn vẹn sứ mệnh tiền nhân giao phó.',
    objectives: [
      { id: 'defeat-hac-an', description: 'Tiêu diệt thực thể Hắc Ấn Vô Diện', kind: 'kill', targetId: 'hac-an', requiredCount: 1 },
    ],
    reward: { gold: 500, xp: 800, items: [{ itemId: 'jade-charm', quantity: 2 }, { itemId: 'spirit-stone', quantity: 10 }] },
  },
]);

// ============================================================================
// 8. NHIỆM VỤ PHỤ TUYẾN (15 SIDE QUESTS)
// ============================================================================

export const SIDE_QUESTS: readonly ContentQuest[] = deepFreeze([
  // 1. Làng Lạc Thủy - Bà Mo
  {
    id: 'sq-01-thao-duoc-ba-mo',
    title: 'Thảo Dược Hồi Sinh',
    kind: 'side',
    chapterId: 1,
    areaId: 'lang-lac-thuy',
    giverNpcId: 'village-healer',
    turnInNpcId: 'village-healer',
    requiredLevel: 1,
    description: 'Giúp Bà Mo thu thập thảo dược quý ven bờ suối để điều chế cao trị thương cho dân làng bị yêu quái tấn công.',
    objectives: [
      { id: 'collect-herbs', description: 'Thu thập thảo dược từ Mộc Tinh Ấu Thể', kind: 'collect', targetId: 'herbal-balm', requiredCount: 3 },
    ],
    reward: { gold: 40, xp: 60, items: [{ itemId: 'herbal-balm', quantity: 2 }] },
  },
  // 2. Làng Lạc Thủy - Thợ rèn
  {
    id: 'sq-02-dong-do-bach-viet',
    title: 'Mảnh Đồng Rèn Kiếm',
    kind: 'side',
    chapterId: 1,
    areaId: 'lang-lac-thuy',
    giverNpcId: 'village-smith',
    turnInNpcId: 'village-smith',
    requiredLevel: 1,
    description: 'Đem mảnh đồng cổ thu được từ quái vật về cho thợ rèn Bách Việt để tôi luyện thành phôi vũ khí sắc bén.',
    objectives: [
      { id: 'collect-bronze-scraps', description: 'Thu thập mảnh đồng cổ', kind: 'collect', targetId: 'bronze-scrap', requiredCount: 4 },
    ],
    reward: { gold: 45, xp: 70, items: [{ itemId: 'bronze-scrap', quantity: 2 }] },
  },
  // 3. Làng Lạc Thủy - Ngư Ông
  {
    id: 'sq-03-nhip-song-song-hong',
    title: 'Lưới Rách Bến Giang',
    kind: 'side',
    chapterId: 1,
    areaId: 'lang-lac-thuy',
    giverNpcId: 'ngu-ong-ba-vi',
    turnInNpcId: 'ngu-ong-ba-vi',
    requiredLevel: 2,
    description: 'Tiêu diệt Ma Trơi U Ám quấy phá bến đò Lạc Thủy vào ban đêm khiến dân chài không dám quăng lưới thả câu.',
    objectives: [
      { id: 'hunt-wisps', description: 'Thổi tắt Ma Trơi U Ám ven sông', kind: 'kill', targetId: 'ma-troi-u-am', requiredCount: 4 },
    ],
    reward: { gold: 50, xp: 75, items: [{ itemId: 'spirit-tea', quantity: 1 }] },
  },
  // 4. Rừng Trúc - Đạo Sĩ Trúc Lâm
  {
    id: 'sq-04-tinh-truc-u-minh',
    title: 'Trúc Lục Trừ Tà',
    kind: 'side',
    chapterId: 1,
    areaId: 'rung-truc-u-minh',
    giverNpcId: 'dao-si-truc-lam',
    turnInNpcId: 'dao-si-truc-lam',
    requiredLevel: 2,
    description: 'Thu thập thân tre xanh ngàn năm từ Độc Xà Trúc Diệp để Đạo Sĩ Trúc Lâm lập đàn tràng phong tỏa chướng khí rừng sâu.',
    objectives: [
      { id: 'hunt-bamboo-snakes', description: 'Trừ khử Độc Xà Trúc Diệp trên ngọn tre', kind: 'kill', targetId: 'dia-yeu-canh-truc', requiredCount: 5 },
    ],
    reward: { gold: 60, xp: 90, items: [{ itemId: 'spirit-stone', quantity: 2 }] },
  },
  // 5. Rừng Trúc - Thợ Săn
  {
    id: 'sq-05-tieng-hu-dem-trang',
    title: 'Nanh Hắc Lang',
    kind: 'side',
    chapterId: 1,
    areaId: 'rung-truc-u-minh',
    giverNpcId: 'tho-san-tan-vien',
    turnInNpcId: 'tho-san-tan-vien',
    requiredLevel: 2,
    description: 'Hỗ trợ thợ săn sơn cước tiêu diệt bầy Hắc Lang Nanh Dài hung hãn đang chặn đường tiến sâu vào sào huyệt thú dữ.',
    objectives: [
      { id: 'hunt-dark-wolves', description: 'Săn Hắc Lang Nanh Dài trong rừng trúc', kind: 'kill', targetId: 'soi-rung-hac-am', requiredCount: 6 },
    ],
    reward: { gold: 70, xp: 100, items: [{ itemId: 'herbal-balm', quantity: 2 }] },
  },
  // 6. Rừng Trúc - Động Âm Hồn
  {
    id: 'sq-06-bi-an-dong-am-hon',
    title: 'Ác Mộng Trong Hang Động',
    kind: 'side',
    chapterId: 1,
    areaId: 'rung-truc-u-minh',
    giverNpcId: 'dao-si-truc-lam',
    turnInNpcId: 'dao-si-truc-lam',
    requiredLevel: 3,
    description: 'Đột kích vào hang Động Âm Hồn, tiêu diệt hộ pháp Bạch Trảo Hổ Ma để thanh tẩy ổ ma thú phụ trợ cho Hổ Yêu.',
    objectives: [
      { id: 'defeat-elite-tiger', description: 'Đánh bại Bạch Trảo Hổ Ma trong Động Âm Hồn', kind: 'kill', targetId: 'bach-trao-ho-ma', requiredCount: 1 },
    ],
    reward: { gold: 90, xp: 140, items: [{ itemId: 'jade-charm', quantity: 1 }] },
  },
  // 7. Đầm Thiêng - Tiên Nữ
  {
    id: 'sq-07-sen-ngoc-dam-thieng',
    title: 'Tinh Hoa Sen Ngũ Sắc',
    kind: 'side',
    chapterId: 2,
    areaId: 'dam-thieng',
    giverNpcId: 'tien-nu-dam-sen',
    turnInNpcId: 'tien-nu-dam-sen',
    requiredLevel: 3,
    description: 'Bảo vệ đầm sen thiêng trước sự xâm lăng của loài Quái Ngư Đầm Bùn chuyên cắn phá ngó sen thanh khiết.',
    objectives: [
      { id: 'hunt-mud-fish', description: 'Tiêu diệt Quái Ngư Đầm Bùn xung quanh đầm sen', kind: 'kill', targetId: 'thuy-quai-tam-ngu', requiredCount: 7 },
    ],
    reward: { gold: 80, xp: 130, items: [{ itemId: 'spirit-tea', quantity: 3 }] },
  },
  // 8. Đầm Thiêng - Thương Nhân
  {
    id: 'sq-08-kho-bau-chim-sau',
    title: 'Rương Cổ Thủy Thần',
    kind: 'side',
    chapterId: 2,
    areaId: 'dam-thieng',
    giverNpcId: 'thuong-nhan-van-lang',
    turnInNpcId: 'thuong-nhan-van-lang',
    requiredLevel: 4,
    description: 'Tìm kiếm rương hàng buôn bị Bọ Cạp Bùn Đen tha xuống đáy bùn lầy sâu của Đầm Thiêng Ba Vì.',
    objectives: [
      { id: 'hunt-mud-scorpions', description: 'Hạ gục Bọ Cạp Bùn Đen để lấy lại hàng hóa', kind: 'kill', targetId: 'bo-cap-dam-lay', requiredCount: 5 },
    ],
    reward: { gold: 110, xp: 170, items: [{ itemId: 'bronze-scrap', quantity: 4 }] },
  },
  // 9. Đầm Thiêng - Lão Nhân Thủy Tộc
  {
    id: 'sq-09-doc-dia-hoang-loan',
    title: 'Diệt Trừ Cự Đỉa',
    kind: 'side',
    chapterId: 2,
    areaId: 'dam-thieng',
    giverNpcId: 'thuy-toc-lao-nhan',
    turnInNpcId: 'thuy-toc-lao-nhan',
    requiredLevel: 4,
    description: 'Tru diệt loài Thủy Đỉa Cự Yêu hung ác đang sinh sôi quá mức làm ô nhiễm dòng nước sinh hoạt của cư dân ven đầm.',
    objectives: [
      { id: 'hunt-giant-leeches', description: 'Tiêu diệt Thủy Đỉa Cự Yêu dưới bùn sâu', kind: 'kill', targetId: 'dia-dia-khong-lo', requiredCount: 6 },
    ],
    reward: { gold: 95, xp: 150, items: [{ itemId: 'spirit-stone', quantity: 3 }] },
  },
  // 10. Núi Tản Viên - Dược Sư
  {
    id: 'sq-10-long-vua-thiet-dieu',
    title: 'Lông Cánh Thiết Điểu',
    kind: 'side',
    chapterId: 3,
    areaId: 'nui-tan-vien',
    giverNpcId: 'linh-y-nui-cao',
    turnInNpcId: 'linh-y-nui-cao',
    requiredLevel: 5,
    description: 'Thu nhặt lông sắt của loài chim Thiết Điểu Ưng Phong để Dược Sư Bạch Hạc nghiền làm bột dược luyện giáp kim cang.',
    objectives: [
      { id: 'hunt-iron-raptors', description: 'Săn Thiết Điểu Ưng Phong trên mỏm đá', kind: 'kill', targetId: 'dieu-sat-tan-vien', requiredCount: 5 },
    ],
    reward: { gold: 120, xp: 190, items: [{ itemId: 'bamboo-armor', quantity: 1 }] },
  },
  // 11. Núi Tản Viên - Dược Sư
  {
    id: 'sq-11-tuyet-dinh-hoa-linh',
    title: 'Linh Dược Vách Đá',
    kind: 'side',
    chapterId: 3,
    areaId: 'nui-tan-vien',
    giverNpcId: 'linh-y-nui-cao',
    turnInNpcId: 'linh-y-nui-cao',
    requiredLevel: 6,
    description: 'Trèo lên vách đá cheo leo hái đóa Tuyết Liên ngàn năm giải trừ độc khí tà ma cho nghĩa sĩ sơn cước.',
    objectives: [
      { id: 'collect-highland-lotus', description: 'Hái đóa sen tuyết ngàn năm trên đỉnh Tản Viên', kind: 'flag', targetId: 'linh-y-nui-cao', requiredCount: 1 },
    ],
    reward: { gold: 130, xp: 210, items: [{ itemId: 'herbal-balm', quantity: 4 }] },
  },
  // 12. Núi Tản Viên - Sơn Cước Dũng Tướng
  {
    id: 'sq-12-tieng-gam-rung-nui',
    title: 'Trấn Áp Cổ Thạch Binh',
    kind: 'side',
    chapterId: 3,
    areaId: 'nui-tan-vien',
    giverNpcId: 'chien-tuong-son-cuoc',
    turnInNpcId: 'chien-tuong-son-cuoc',
    requiredLevel: 6,
    description: 'Đập tan các bức tượng Cổ Thạch Hồn Binh bị kích động trước khi chúng tiến xuống phá hủy bản làng dưới chân núi.',
    objectives: [
      { id: 'smash-stone-soldiers', description: 'Hạ gục Cổ Thạch Hồn Binh trên đường đèo', kind: 'kill', targetId: 'thach-binh-co', requiredCount: 5 },
    ],
    reward: { gold: 140, xp: 230, items: [{ itemId: 'spirit-stone', quantity: 4 }] },
  },
  // 13. Phong Châu - Tướng Quân Cổ Loa
  {
    id: 'sq-13-chiec-no-than-co',
    title: 'Dấu Vết Mũi Tên Đồng',
    kind: 'side',
    chapterId: 4,
    areaId: 'phong-chau',
    giverNpcId: 'quan-thi-ve-phong-chau',
    turnInNpcId: 'quan-thi-ve-phong-chau',
    requiredLevel: 8,
    description: 'Truy tìm các mũi tên đồng thần bí bị Vô Ảnh Cung Thủ cướp đoạt mang về kho vũ khí hoàng thành Phong Châu.',
    objectives: [
      { id: 'hunt-shadow-archers', description: 'Tiêu diệt Vô Ảnh Cung Thủ ẩn mình trong đêm', kind: 'kill', targetId: 'u-linh-cung-thu', requiredCount: 6 },
    ],
    reward: { gold: 180, xp: 280, items: [{ itemId: 'bronze-spear', quantity: 1 }] },
  },
  // 14. Phong Châu - Đại Tế Tư
  {
    id: 'sq-14-van-khac-trong-dong',
    title: 'Mảnh Vỡ Trống Đồng',
    kind: 'side',
    chapterId: 4,
    areaId: 'phong-chau',
    giverNpcId: 'te-tu-hoang-cung',
    turnInNpcId: 'te-tu-hoang-cung',
    requiredLevel: 8,
    description: 'Thu hồi các phiến đồng khắc hoa văn chim Lạc bị ma binh hắc ám đánh cắp để Đại Tế Tư khôi phục trận đồ hộ quốc.',
    objectives: [
      { id: 'collect-drum-fragments', description: 'Đoạt lại phiến đồng từ Hắc Vệ Ma Tăng', kind: 'collect', targetId: 'bronze-scrap', requiredCount: 5 },
    ],
    reward: { gold: 200, xp: 320, items: [{ itemId: 'spirit-stone', quantity: 5 }] },
  },
  // 15. Phong Châu - Kỵ Sĩ Thần Châu
  {
    id: 'sq-15-linh-hon-ho-ve',
    title: 'Chiêu Hồn Hộ Thành',
    kind: 'side',
    chapterId: 4,
    areaId: 'phong-chau',
    giverNpcId: 'ky-nhan-khong-lo',
    turnInNpcId: 'ky-nhan-khong-lo',
    requiredLevel: 9,
    description: 'Thắp nén hương thiêng siêu độ cho anh linh các nghĩa sĩ Văn Lang đã hy sinh trong cuộc chiến chống lại thực thể hắc ám.',
    objectives: [
      { id: 'light-spirit-incense', description: 'Thắp hương tưởng niệm tại Điện Kính Thiên', kind: 'flag', targetId: 'ky-nhan-khong-lo', requiredCount: 1 },
    ],
    reward: { gold: 250, xp: 400, items: [{ itemId: 'jade-charm', quantity: 1 }] },
  },
]);

// ============================================================================
// 9. DANH MỤC TỔNG HỢP (UNIFIED CONTENT CATALOG)
// ============================================================================

export const ALL_QUESTS: readonly ContentQuest[] = deepFreeze([
  ...MAIN_QUESTS,
  ...SIDE_QUESTS,
]);

export interface ContentCatalog {
  readonly chapters: readonly ContentChapter[];
  readonly areas: readonly ContentArea[];
  readonly dungeons: readonly ContentDungeon[];
  readonly npcs: readonly ContentNpc[];
  readonly commonEnemies: readonly ContentEnemy[];
  readonly elites: readonly ContentElite[];
  readonly mainQuests: readonly ContentQuest[];
  readonly sideQuests: readonly ContentQuest[];
  readonly quests: readonly ContentQuest[];
}

export const CONTENT_CATALOG: ContentCatalog = deepFreeze({
  chapters: CHAPTERS,
  areas: MAIN_AREAS,
  dungeons: DUNGEONS,
  npcs: NAMED_NPCS,
  commonEnemies: COMMON_ENEMIES,
  elites: ELITES,
  mainQuests: MAIN_QUESTS,
  sideQuests: SIDE_QUESTS,
  quests: ALL_QUESTS,
});

// ============================================================================
// 10. BỘ HÀM TRA CỨU TIỆN ÍCH (LOOKUP & FILTER HELPERS)
// ============================================================================

export function getChapter(id: number): ContentChapter | undefined {
  return CHAPTERS.find((ch) => ch.id === id);
}

export function getArea(id: string): ContentArea | undefined {
  return MAIN_AREAS.find((area) => area.id === id);
}

export function getDungeon(id: string): ContentDungeon | undefined {
  return DUNGEONS.find((dungeon) => dungeon.id === id);
}

export function getNpc(id: string): ContentNpc | undefined {
  return NAMED_NPCS.find((npc) => npc.id === id);
}

export function getEnemy(id: string): ContentEnemy | undefined {
  return COMMON_ENEMIES.find((enemy) => enemy.id === id);
}

export function getElite(id: string): ContentElite | undefined {
  return ELITES.find((elite) => elite.id === id);
}

export function getQuest(id: string): ContentQuest | undefined {
  return ALL_QUESTS.find((quest) => quest.id === id);
}

export function getMainQuests(): readonly ContentQuest[] {
  return MAIN_QUESTS;
}

export function getSideQuests(): readonly ContentQuest[] {
  return SIDE_QUESTS;
}

export function getQuestsByChapter(chapterId: number): readonly ContentQuest[] {
  return ALL_QUESTS.filter((quest) => quest.chapterId === chapterId);
}

export function getQuestsByArea(areaId: string): readonly ContentQuest[] {
  return ALL_QUESTS.filter((quest) => quest.areaId === areaId);
}

export function getQuestsByNpc(npcId: string): readonly ContentQuest[] {
  return ALL_QUESTS.filter((quest) => quest.giverNpcId === npcId || quest.turnInNpcId === npcId);
}

export function getEnemiesByArea(areaId: string): readonly ContentEnemy[] {
  return COMMON_ENEMIES.filter((enemy) => enemy.areaId === areaId);
}

export function getDungeonsByArea(areaId: string): readonly ContentDungeon[] {
  return DUNGEONS.filter((dungeon) => dungeon.areaId === areaId);
}

export function getNpcsByArea(areaId: string): readonly ContentNpc[] {
  return NAMED_NPCS.filter((npc) => npc.areaId === areaId);
}
