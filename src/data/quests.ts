export type QuestObjectiveKind = 'kill' | 'flag';
export type QuestState = 'Locked' | 'Available' | 'Active' | 'Completed' | 'RewardClaimed';
export type QuestCategory = 'main' | 'side';

export interface QuestProgress {
  readonly state: QuestState;
  readonly kills: number;
  readonly bossKilled: boolean;
}

export interface QuestObjective {
  readonly id: string;
  readonly kind: QuestObjectiveKind;
  readonly target: string;
  readonly required: number;
  readonly description?: string;
}

export interface QuestRewardItem {
  readonly itemId: string;
  readonly quantity: number;
}

export interface QuestReward {
  readonly gold: number;
  readonly xp: number;
  readonly items: readonly QuestRewardItem[];
}

export interface QuestDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly giverNpcId: string;
  readonly objectives: readonly QuestObjective[];
  readonly reward: QuestReward;
  readonly category: QuestCategory;
  readonly chapter?: number;
}

export const QUESTS: readonly QuestDefinition[] = [
  // ==========================================
  // CHƯƠNG 1: ĐIỀM DỮ RỪNG TRÚC (MAIN QUESTS)
  // ==========================================
  {
    id: 'hunt-ho-yeu',
    title: 'Dẹp Loạn Hổ Yêu',
    description: 'Săn đủ yêu quái trong rừng trúc, hạ Hổ Yêu rồi trở về báo tin.',
    giverNpcId: 'village-chief',
    category: 'main',
    chapter: 1,
    objectives: [
      { id: 'forest-kills', kind: 'kill', target: 'forest-enemy', required: 6 },
      { id: 'ho-yeu', kind: 'kill', target: 'ho-yeu', required: 1 },
    ],
    reward: { gold: 100, xp: 140, items: [{ itemId: 'jade-charm', quantity: 1 }] },
  },
  {
    id: 'main-c1-02-mo-duong-rung-truc',
    title: 'Khai Thông Cổ Đạo Rừng Trúc',
    description: 'Tiêu diệt Mộc Tinh cản trở lối vào sâu rừng già và thắp sáng đài lửa Lạc Việt.',
    giverNpcId: 'village-chief',
    category: 'main',
    chapter: 1,
    objectives: [
      { id: 'c1-kill-moc-tinh', kind: 'kill', target: 'moc-tinh', required: 4 },
      { id: 'c1-flag-light-beacon', kind: 'flag', target: 'beacon-lit', required: 1 },
    ],
    reward: { gold: 70, xp: 90, items: [{ itemId: 'herbal-balm', quantity: 2 }] },
  },
  {
    id: 'main-c1-03-tru-ma-troi',
    title: 'Trấn Áp Tà Khí Ma Trơi',
    description: 'Tiêu diệt bầy Ma Trơi tụ tập quanh khe suối để lấy tàn hỏa thanh tẩy cho bản làng.',
    giverNpcId: 'village-healer',
    category: 'main',
    chapter: 1,
    objectives: [
      { id: 'c1-kill-ma-troi', kind: 'kill', target: 'ma-troi', required: 5 },
      { id: 'c1-flag-cleanse-spring', kind: 'flag', target: 'spring-cleansed', required: 1 },
    ],
    reward: { gold: 80, xp: 110, items: [{ itemId: 'spirit-tea', quantity: 2 }] },
  },
  {
    id: 'main-c1-04-khi-tuc-lam-son',
    title: 'Khí Tức Lam Sơn Cổ Mộc',
    description: 'Hạ gục yêu thú rình rập và tìm mảnh đồng cổ thất lạc để gia cố phong ấn bản làng.',
    giverNpcId: 'village-smith',
    category: 'main',
    chapter: 1,
    objectives: [
      { id: 'c1-kill-forest-prowlers', kind: 'kill', target: 'forest-enemy', required: 8 },
      { id: 'c1-flag-deliver-relic', kind: 'flag', target: 'relic-recovered', required: 1 },
    ],
    reward: { gold: 95, xp: 130, items: [{ itemId: 'bronze-scrap', quantity: 3 }] },
  },

  // ==========================================
  // CHƯƠNG 2: BÓNG ĐEN ĐẦM THIÊNG (MAIN QUESTS)
  // ==========================================
  {
    id: 'main-c2-01-song-du-da-trach',
    title: 'Sóng Dữ Đầm Dạ Trạch',
    description: 'Dẹp sạch thủy quái quấy phá bến thuyền và cắm cọc gỗ giữ trận địa ven bờ đầm Dạ Trạch.',
    giverNpcId: 'fisherman-da-trach',
    category: 'main',
    chapter: 2,
    objectives: [
      { id: 'c2-kill-water-fiends', kind: 'kill', target: 'water-fiend', required: 8 },
      { id: 'c2-flag-raise-palisade', kind: 'flag', target: 'palisade-raised', required: 1 },
    ],
    reward: { gold: 120, xp: 160, items: [{ itemId: 'spirit-stone', quantity: 2 }] },
  },
  {
    id: 'main-c2-02-chu-dong-tu-di-tich',
    title: 'Dấu Tích Chử Đồng Tử',
    description: 'Khảo sát bãi Tự Nhiên, giải phóng tà chướng giam hãm cổ vật nón gậy thần thông.',
    giverNpcId: 'shaman-au-co',
    category: 'main',
    chapter: 2,
    objectives: [
      { id: 'c2-kill-marsh-lurkers', kind: 'kill', target: 'marsh-lurker', required: 6 },
      { id: 'c2-flag-relic-staff', kind: 'flag', target: 'staff-relic-found', required: 1 },
    ],
    reward: { gold: 135, xp: 180, items: [{ itemId: 'spirit-tea', quantity: 3 }] },
  },
  {
    id: 'main-c2-03-ngu-tinh-tram-pha',
    title: 'Trảm Phá Ngư Tinh Đáy Nước',
    description: 'Thần ngư đọa lạc làm chìm đắm thuyền bè, hãy tiêu diệt phân thân Ngư Tinh để mở luồng nước.',
    giverNpcId: 'fisherman-da-trach',
    category: 'main',
    chapter: 2,
    objectives: [
      { id: 'c2-kill-ngu-tinh-spawn', kind: 'kill', target: 'ngu-tinh-spawn', required: 5 },
      { id: 'c2-flag-channel-unblocked', kind: 'flag', target: 'channel-unblocked', required: 1 },
    ],
    reward: { gold: 150, xp: 200, items: [{ itemId: 'jade-charm', quantity: 1 }] },
  },
  {
    id: 'main-c2-04-thuong-luong-hoa-kiep',
    title: 'Thuồng Luồng Hóa Kiếp',
    description: 'Quyết chiến Thuồng Luồng Nhiễm Tà dưới đáy Đầm Thiêng để trả lại thanh bình cho sông nước.',
    giverNpcId: 'village-chief',
    category: 'main',
    chapter: 2,
    objectives: [
      { id: 'c2-kill-thuong-luong', kind: 'kill', target: 'thuong-luong', required: 1 },
      { id: 'c2-flag-waters-purified', kind: 'flag', target: 'waters-purified', required: 1 },
    ],
    reward: { gold: 200, xp: 260, items: [{ itemId: 'bronze-spear', quantity: 1 }] },
  },

  // ==========================================
  // CHƯƠNG 3: LỜI NGUYỀN NÚI THIÊNG (MAIN QUESTS)
  // ==========================================
  {
    id: 'main-c3-01-tan-vien-phong-van',
    title: 'Tản Viên Phong Vân',
    description: 'Leo vách đá Tản Viên, trảm diệt dã thú nhiễm oán khí để tiếp cận lối lên Đền Thượng.',
    giverNpcId: 'hermit-tan-vien',
    category: 'main',
    chapter: 3,
    objectives: [
      { id: 'c3-kill-mountain-beasts', kind: 'kill', target: 'mountain-beast', required: 9 },
      { id: 'c3-flag-reach-shrine', kind: 'flag', target: 'shrine-reached', required: 1 },
    ],
    reward: { gold: 170, xp: 230, items: [{ itemId: 'herbal-balm', quantity: 3 }] },
  },
  {
    id: 'main-c3-02-thach-tran-son-tinh',
    title: 'Trận Đồ Sơn Tinh',
    description: 'Vượt qua thạch nhân trấn cửa và tiếp nhận chân truyền Thần Lực Địa Long tại linh đài.',
    giverNpcId: 'hermit-tan-vien',
    category: 'main',
    chapter: 3,
    objectives: [
      { id: 'c3-kill-stone-guardians', kind: 'kill', target: 'stone-guardian', required: 6 },
      { id: 'c3-flag-pillars-activated', kind: 'flag', target: 'pillars-activated', required: 1 },
    ],
    reward: { gold: 185, xp: 250, items: [{ itemId: 'spirit-stone', quantity: 4 }] },
  },
  {
    id: 'main-c3-03-linh-moc-ngan-nam',
    title: 'Thanh Lọc Cổ Mộc Linh Thần',
    description: 'Cây thiêng nghìn năm bị rễ độc xâm lấn, dẹp sạch quái thú vây quanh và rưới nước cam lộ phục hồi rễ thần.',
    giverNpcId: 'village-healer',
    category: 'main',
    chapter: 3,
    objectives: [
      { id: 'c3-kill-corrupt-roots', kind: 'kill', target: 'corrupt-root', required: 7 },
      { id: 'c3-flag-dew-sprinkled', kind: 'flag', target: 'dew-sprinkled', required: 1 },
    ],
    reward: { gold: 200, xp: 280, items: [{ itemId: 'bamboo-armor', quantity: 1 }] },
  },
  {
    id: 'main-c3-04-thach-tuong-chan-son',
    title: 'Thạch Tướng Trấn Sơn',
    description: 'Hạ gục Thạch Tướng Bị Nguyền trên đỉnh non cao và giải phóng phong ấn hộ vệ Văn Lang.',
    giverNpcId: 'hermit-tan-vien',
    category: 'main',
    chapter: 3,
    objectives: [
      { id: 'c3-kill-thach-tuong', kind: 'kill', target: 'thach-tuong', required: 1 },
      { id: 'c3-flag-seal-cleansed', kind: 'flag', target: 'seal-cleansed', required: 1 },
    ],
    reward: { gold: 240, xp: 320, items: [{ itemId: 'jade-charm', quantity: 1 }] },
  },

  // ==========================================
  // CHƯƠNG 4: THIÊN MỆNH VĂN LANG (MAIN QUESTS)
  // ==========================================
  {
    id: 'main-c4-01-dien-kien-hung-vuong',
    title: 'Yết Kiến Hùng Vương Triều Đình',
    description: 'Vào điện Phong Châu dâng sớ báo công dẹp loạn ba cõi và nhận lệnh triệu tập binh sĩ Lạc Hồng.',
    giverNpcId: 'messenger-phong-chau',
    category: 'main',
    chapter: 4,
    objectives: [
      { id: 'c4-kill-infiltrators', kind: 'kill', target: 'court-infiltrator', required: 6 },
      { id: 'c4-flag-audience-completed', kind: 'flag', target: 'audience-completed', required: 1 },
    ],
    reward: { gold: 250, xp: 340, items: [{ itemId: 'bronze-scrap', quantity: 5 }] },
  },
  {
    id: 'main-c4-02-kim-quy-chi-dan',
    title: 'Thần Kim Quy Chỉ Lối',
    description: 'Cầu kiến Thần Kim Quy nơi ngã ba sông Hạc, dâng ngọc báu nhận linh phù phá tan Hư Vô Tà Trận.',
    giverNpcId: 'village-chief',
    category: 'main',
    chapter: 4,
    objectives: [
      { id: 'c4-kill-void-shades', kind: 'kill', target: 'void-shade', required: 8 },
      { id: 'c4-flag-kim-quy-blessing', kind: 'flag', target: 'kim-quy-blessed', required: 1 },
    ],
    reward: { gold: 270, xp: 370, items: [{ itemId: 'spirit-stone', quantity: 5 }] },
  },
  {
    id: 'main-c4-03-pha-tran-hac-an',
    title: 'Phá Diệt Trận Đồ Hắc Ám',
    description: 'Tiêu diệt hộ pháp tà môn và đập vỡ bốn trụ hắc ám phong tỏa mạch ngầm kinh đô Phong Châu.',
    giverNpcId: 'village-smith',
    category: 'main',
    chapter: 4,
    objectives: [
      { id: 'c4-kill-dark-cultists', kind: 'kill', target: 'dark-cultist', required: 10 },
      { id: 'c4-flag-pillars-shattered', kind: 'flag', target: 'pillars-shattered', required: 1 },
    ],
    reward: { gold: 290, xp: 400, items: [{ itemId: 'spirit-tea', quantity: 4 }] },
  },
  {
    id: 'main-c4-04-thien-menh-chi-quang',
    title: 'Thiên Mệnh Chi Quang',
    description: 'Đối đầu Hắc Ấn Vô Diện trong thâm cung Phong Châu, khôi phục vĩnh cửu thái bình cho muôn dân Bách Việt.',
    giverNpcId: 'village-chief',
    category: 'main',
    chapter: 4,
    objectives: [
      { id: 'c4-kill-hac-an', kind: 'kill', target: 'hac-an', required: 1 },
      { id: 'c4-flag-peace-restored', kind: 'flag', target: 'peace-restored', required: 1 },
    ],
    reward: { gold: 350, xp: 500, items: [{ itemId: 'jade-charm', quantity: 2 }] },
  },

  // ==========================================
  // NHIỆM VỤ PHỤ (SIDE QUESTS - 16 QUESTS)
  // ==========================================
  {
    id: 'side-01-thuoc-tri-chuong-khi',
    title: 'Dược Liệu Trừ Chướng Khí',
    description: 'Thu gom thảo mộc ven bìa rừng Trúc để bào chế thuốc giải độc chướng khí cho trẻ nhỏ trong làng.',
    giverNpcId: 'village-healer',
    category: 'side',
    objectives: [
      { id: 'side-kill-spiders', kind: 'kill', target: 'forest-spider', required: 5 },
      { id: 'side-flag-herbs-gathered', kind: 'flag', target: 'herbs-gathered', required: 1 },
    ],
    reward: { gold: 45, xp: 60, items: [{ itemId: 'herbal-balm', quantity: 2 }] },
  },
  {
    id: 'side-02-tra-than-luc-ba-mo',
    title: 'Hương Trà Bách Thảo',
    description: 'Tìm lá trà tiên trên đồi hoang và xua đuổi bầy chim dữ quấy nhiễu.',
    giverNpcId: 'village-healer',
    category: 'side',
    objectives: [
      { id: 'side-kill-wild-crows', kind: 'kill', target: 'wild-crow', required: 4 },
      { id: 'side-flag-tea-leaves', kind: 'flag', target: 'tea-leaves-picked', required: 1 },
    ],
    reward: { gold: 50, xp: 65, items: [{ itemId: 'spirit-tea', quantity: 2 }] },
  },
  {
    id: 'side-03-ren-giao-dong-do',
    title: 'Tôi Luyện Đồng Đỏ Cổ Loa',
    description: 'Thu thập quặng đồng và đánh tan đám trộm cắp phôi rèn nơi mỏ đá.',
    giverNpcId: 'village-smith',
    category: 'side',
    objectives: [
      { id: 'side-kill-copper-thieves', kind: 'kill', target: 'copper-thief', required: 6 },
      { id: 'side-flag-ore-delivered', kind: 'flag', target: 'ore-delivered', required: 1 },
    ],
    reward: { gold: 60, xp: 80, items: [{ itemId: 'bronze-scrap', quantity: 3 }] },
  },
  {
    id: 'side-04-ngoc-boi-to-tien',
    title: 'Kỷ Vật Ngọc Bội Lạc Việt',
    description: 'Tìm lại ngọc bội gia truyền bị dã thú tha mất trong hốc đá ven sông.',
    giverNpcId: 'village-chief',
    category: 'side',
    objectives: [
      { id: 'side-kill-cave-beasts', kind: 'kill', target: 'cave-beast', required: 4 },
      { id: 'side-flag-jade-recovered', kind: 'flag', target: 'jade-recovered', required: 1 },
    ],
    reward: { gold: 65, xp: 85, items: [{ itemId: 'jade-charm', quantity: 1 }] },
  },
  {
    id: 'side-05-san-ma-troi-dong-hoang',
    title: 'Trừ Tiệt Ma Trơi Đồng Hoang',
    description: 'Canh gác bờ đê đêm trăng, tiêu diệt bầy ma trơi đe dọa người gặt lúa muộn.',
    giverNpcId: 'village-chief',
    category: 'side',
    objectives: [
      { id: 'side-kill-night-spirits', kind: 'kill', target: 'ma-troi', required: 7 },
    ],
    reward: { gold: 55, xp: 75, items: [{ itemId: 'spirit-stone', quantity: 2 }] },
  },
  {
    id: 'side-06-khi-luc-da-linh',
    title: 'Khai Thác Đá Linh Khí',
    description: 'Khai mở mạch đá ngũ sắc tại chân núi Ba Vì để cung cấp linh thạch tôi luyện giáp trận.',
    giverNpcId: 'village-smith',
    category: 'side',
    objectives: [
      { id: 'side-kill-golem-scouts', kind: 'kill', target: 'golem-scout', required: 5 },
      { id: 'side-flag-spirit-vein', kind: 'flag', target: 'vein-tapped', required: 1 },
    ],
    reward: { gold: 70, xp: 95, items: [{ itemId: 'spirit-stone', quantity: 3 }] },
  },
  {
    id: 'side-07-thanh-loc-nguon-nuoc',
    title: 'Thanh Lọc Dòng Suối Thượng Nguồn',
    description: 'Tiêu diệt độc trùng và thả sen thiêng tẩy trần dòng suối nuôi sống bản làng.',
    giverNpcId: 'village-healer',
    category: 'side',
    objectives: [
      { id: 'side-kill-poison-toads', kind: 'kill', target: 'poison-toad', required: 6 },
      { id: 'side-flag-lotus-planted', kind: 'flag', target: 'lotus-planted', required: 1 },
    ],
    reward: { gold: 60, xp: 80, items: [{ itemId: 'herbal-balm', quantity: 2 }] },
  },
  {
    id: 'side-08-tieng-hat-truong-chi',
    title: 'Tiếng Hát Trương Chi Bên Sông Tiêu',
    description: 'Lắng nghe giai điệu sầu bi trên dòng Tiêu Tương, đánh dẹp yêu quái quấy nhiễu con thuyền cô độc.',
    giverNpcId: 'fisherman-da-trach',
    category: 'side',
    objectives: [
      { id: 'side-kill-river-monsters', kind: 'kill', target: 'river-monster', required: 6 },
      { id: 'side-flag-boat-protected', kind: 'flag', target: 'boat-protected', required: 1 },
    ],
    reward: { gold: 80, xp: 105, items: [{ itemId: 'jade-charm', quantity: 1 }] },
  },
  {
    id: 'side-09-le-vat-lang-lieu',
    title: 'Lễ Vật Bánh Chưng Bánh Giầy',
    description: 'Thu thập nếp thơm và lá dong rừng dâng lên bàn thờ tiên tổ theo truyền tích Tiết Liêu (Lang Liêu).',
    giverNpcId: 'village-chief',
    category: 'side',
    objectives: [
      { id: 'side-kill-field-pests', kind: 'kill', target: 'field-pest', required: 5 },
      { id: 'side-flag-offering-prepared', kind: 'flag', target: 'offering-prepared', required: 1 },
    ],
    reward: { gold: 75, xp: 100, items: [{ itemId: 'spirit-tea', quantity: 3 }] },
  },
  {
    id: 'side-10-long-chim-lac-canh',
    title: 'Họa Tiết Chim Lạc Cổ',
    description: 'Sao chép văn tự và hình bóng chim Lạc khắc trên bia đá cổ để truyền lại cho đời sau.',
    giverNpcId: 'village-smith',
    category: 'side',
    objectives: [
      { id: 'side-kill-ruin-guardians', kind: 'kill', target: 'ruin-guardian', required: 4 },
      { id: 'side-flag-rubbing-taken', kind: 'flag', target: 'rubbing-taken', required: 1 },
    ],
    reward: { gold: 85, xp: 110, items: [{ itemId: 'bronze-scrap', quantity: 4 }] },
  },
  {
    id: 'side-11-tre-ngan-phu-dong',
    title: 'Bụi Tre Ngà Phù Đổng',
    description: 'Chặt những gióng tre đực vàng óng bền chắc để làm cọc phòng thủ và đan giáp nhẹ.',
    giverNpcId: 'village-chief',
    category: 'side',
    objectives: [
      { id: 'side-kill-bamboo-sprites', kind: 'kill', target: 'moc-tinh', required: 6 },
      { id: 'side-flag-bamboo-collected', kind: 'flag', target: 'bamboo-collected', required: 1 },
    ],
    reward: { gold: 90, xp: 120, items: [{ itemId: 'bamboo-armor', quantity: 1 }] },
  },
  {
    id: 'side-12-ruou-can-lac-hong',
    title: 'Hương Men Rượu Cần Men Lá',
    description: 'Tìm gom ba loại men lá rừng già để ủ hũ rượu cần dâng lễ hội đền Hùng.',
    giverNpcId: 'village-healer',
    category: 'side',
    objectives: [
      { id: 'side-kill-forest-badgers', kind: 'kill', target: 'forest-badger', required: 5 },
      { id: 'side-flag-yeast-gathered', kind: 'flag', target: 'yeast-gathered', required: 1 },
    ],
    reward: { gold: 70, xp: 90, items: [{ itemId: 'herbal-balm', quantity: 2 }] },
  },
  {
    id: 'side-13-tieng-trong-dong-thieng',
    title: 'Âm Vang Trống Đồng Đông Sơn',
    description: 'Hộ tống thợ đúc đưa mặt trống đồng lên đài cao tế lễ và gióng hồi chuông cảnh báo tà khí.',
    giverNpcId: 'village-smith',
    category: 'side',
    objectives: [
      { id: 'side-kill-drum-ambushers', kind: 'kill', target: 'drum-ambusher', required: 7 },
      { id: 'side-flag-drum-sounded', kind: 'flag', target: 'drum-sounded', required: 1 },
    ],
    reward: { gold: 100, xp: 135, items: [{ itemId: 'bronze-spear', quantity: 1 }] },
  },
  {
    id: 'side-14-cau-ngu-lac-long-quan',
    title: 'Tế Lễ Cầu Ngư Long Vương',
    description: 'Bảo vệ lễ tế thủy thần Lạc Long Quân trước nanh vuốt của đám thủy quái hung hãn.',
    giverNpcId: 'fisherman-da-trach',
    category: 'side',
    objectives: [
      { id: 'side-kill-sea-fiends', kind: 'kill', target: 'water-fiend', required: 8 },
      { id: 'side-flag-ritual-safe', kind: 'flag', target: 'ritual-safe', required: 1 },
    ],
    reward: { gold: 95, xp: 125, items: [{ itemId: 'spirit-stone', quantity: 3 }] },
  },
  {
    id: 'side-15-hon-da-vong-phu',
    title: 'Hóa Giải Hồn Đá Vọng Phu',
    description: 'Dâng hương trầm lên phiến đá ngóng chồng trên sườn núi, xoa dịu oán niệm ngàn năm.',
    giverNpcId: 'hermit-tan-vien',
    category: 'side',
    objectives: [
      { id: 'side-kill-mourning-wraiths', kind: 'kill', target: 'mourning-wraith', required: 5 },
      { id: 'side-flag-incense-offered', kind: 'flag', target: 'incense-offered', required: 1 },
    ],
    reward: { gold: 90, xp: 120, items: [{ itemId: 'jade-charm', quantity: 1 }] },
  },
  {
    id: 'side-16-mong-rua-vang-an-duong',
    title: 'Mảnh Khóa Móng Rùa Vàng',
    description: 'Tìm lại mảnh lẫy nỏ đồng thất lạc quanh hào thành Cổ Loa để khôi phục bí kíp thần nỏ.',
    giverNpcId: 'messenger-phong-chau',
    category: 'side',
    objectives: [
      { id: 'side-kill-citadel-looters', kind: 'kill', target: 'citadel-looter', required: 6 },
      { id: 'side-flag-trigger-retrieved', kind: 'flag', target: 'trigger-retrieved', required: 1 },
    ],
    reward: { gold: 110, xp: 150, items: [{ itemId: 'bronze-scrap', quantity: 4 }] },
  },
];

export const QUESTS_BY_ID: Readonly<Record<string, QuestDefinition>> = Object.fromEntries(
  QUESTS.map((quest) => [quest.id, quest]),
);

export function getQuest(questId: string): QuestDefinition | undefined {
  return Object.hasOwn(QUESTS_BY_ID, questId) ? QUESTS_BY_ID[questId] : undefined;
}

export function getMainQuests(): readonly QuestDefinition[] {
  return QUESTS.filter((quest) => quest.category === 'main');
}

export function getSideQuests(): readonly QuestDefinition[] {
  return QUESTS.filter((quest) => quest.category === 'side');
}

export function getQuestsByChapter(chapter: number): readonly QuestDefinition[] {
  return QUESTS.filter((quest) => quest.chapter === chapter);
}
