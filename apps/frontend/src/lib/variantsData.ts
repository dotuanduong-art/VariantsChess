export interface SkillInfo {
  id: string;
  name: string;
  cost: number | string;
  targetType: string;
  description: string;
  duration: string;
}

export interface VariantData {
  id: string;
  name: string;
  role: 'Executor' | 'Strategist' | 'Disruptor' | 'Warden' | 'Trickster';
  difficulty: number; // 1 to 5 stars
  description: string;
  artwork: string; // Emoji representing character
  passive: SkillInfo;
  skill1: SkillInfo;
  skill2: SkillInfo;
  ultimate: SkillInfo;
  resourceLabel?: string;
}

export const VARIANTS_LIST: VariantData[] = [
  {
    id: 'lightning',
    name: 'Lightning',
    role: 'Executor',
    difficulty: 3,
    description: 'Bậc thầy về điện năng và tốc độ, gây hiệu ứng làm choáng và quét sạch kẻ địch.',
    artwork: '⚡',
    resourceLabel: 'Stun traps',
    passive: {
      id: 'lightning_passive',
      name: 'Lightning Speed',
      cost: 'None',
      targetType: 'Passive',
      description: 'Mỗi khi quân địch đi vào ô bẫy choáng sẽ +2 AP.',
      duration: 'Permanent',
    },
    skill1: {
      id: 'lightning_thunder_trap',
      name: 'Thunder Trap',
      cost: 3,
      targetType: 'Empty Tile',
      description: 'Đặt một bẫy sét ẩn lên ô trống. Nếu kẻ địch dẫm vào sẽ bị làm choáng trong 2 vòng đấu.',
      duration: 'Permanent',
    },
    skill2: {
      id: 'lightning_electric_terrain',
      name: 'Electric Terrain',
      cost: 8,
      targetType: 'Global Cell',
      description: 'Trong 5 vòng đấu tiếp theo, thời gian đi của mỗi lượt giảm còn 3 giây.',
      duration: '5 rounds',
    },
    ultimate: {
      id: 'lightning_raigeki',
      name: 'Raigeki',
      cost: 12,
      targetType: 'Board-wide',
      description: 'Tiêu diệt tất cả quân địch đang mang hiệu ứng làm choáng (ngoại trừ Vua).',
      duration: 'Instant',
    }
  },
  {
    id: 'zombie',
    name: 'Zombie',
    role: 'Strategist',
    difficulty: 3,
    description: 'Lây lan dịch bệnh, biến binh lính địch thành xác sống và triệu hồi quái vật đông đảo.',
    artwork: '🧟',
    resourceLabel: 'Zombies count',
    passive: {
      id: 'zombie_passive',
      name: 'Zombie Infection',
      cost: 'None',
      targetType: 'Passive',
      description: 'Khi quân cờ Zombie ăn quân địch, quân bị ăn sẽ nhận hiệu ứng nhiễm độc Walker.',
      duration: 'Permanent',
    },
    skill1: {
      id: 'zombie_infection',
      name: 'Infection',
      cost: 5,
      targetType: 'Ally Piece',
      description: 'Chọn 1 quân cờ đồng minh và biến đổi nó thành một Zombie khát máu.',
      duration: 'Permanent',
    },
    skill2: {
      id: 'zombie_mutation',
      name: 'Mutation',
      cost: 4,
      targetType: 'Walker Piece',
      description: 'Biến đổi 1 quân cờ Walker đang bị nhiễm độc thành Zombie thuộc quyền kiểm soát.',
      duration: 'Instant',
    },
    ultimate: {
      id: 'zombie_outbreak',
      name: 'Outbreak',
      cost: 8,
      targetType: 'Graveyard',
      description: 'Hồi sinh 2 quân đồng minh bị chết gần nhất về lại vị trí chết ban đầu.',
      duration: 'Instant',
    }
  },
  {
    id: 'dynamite',
    name: 'Dynamite',
    role: 'Executor',
    difficulty: 4,
    description: 'Gài mìn, cài chất nổ kích nổ chuỗi phản ứng dây chuyền thổi bay toàn bộ quân địch.',
    artwork: '💣',
    resourceLabel: 'Active bombs',
    passive: {
      id: 'dynamite_passive',
      name: 'Explosives',
      cost: 'None',
      targetType: 'Passive',
      description: 'Mỗi khi kích hoạt Ultimate, cộng lại 2 AP. Khi bom được kích hoạt, chúng sẽ gây sát thương với diện tích 3x3 ô xung quanh.',
      duration: 'Permanent',
    },
    skill1: {
      id: 'dynamite_live_charge',
      name: 'Live Charge',
      cost: 3,
      targetType: 'Ally Piece',
      description: 'Gắn một khối thuốc nổ lên quân đồng minh. Quả bom tồn tại cho tới khi kích nổ hoặc quân bị chết.',
      duration: 'Permanent',
    },
    skill2: {
      id: 'dynamite_landmine',
      name: 'Landmine',
      cost: 3,
      targetType: 'Empty Tile',
      description: 'Đặt một quả mìn ẩn trên ô trống. Kẻ địch bước vào sẽ nhận hiệu ứng Bom.',
      duration: 'Permanent',
    },
    ultimate: {
      id: 'dynamite_detonation',
      name: 'Detonation',
      cost: 10,
      targetType: 'Global',
      description: 'Kích nổ tất cả quân cờ đang mang hiệu ứng gắn thuốc nổ Bom trên toàn bàn cờ.',
      duration: 'Instant',
    }
  },
  {
    id: 'magician',
    name: 'Magician',
    role: 'Trickster',
    difficulty: 4,
    description: 'Đánh tráo quân cờ, hoán đổi cách di chuyển và đưa kẻ địch vào chiều không gian ảo giác.',
    artwork: '🔮',
    resourceLabel: 'Spells active',
    passive: {
      id: 'magician_passive',
      name: 'Magic Circle',
      cost: 'None',
      targetType: 'Passive',
      description: 'Phạm vi ảnh hưởng của kỹ năng luôn nằm trong phạm vi 5x5 lấy tâm là quân cờ đầu tiên.',
      duration: '3 rounds',
    },
    skill1: {
      id: 'magician_swap_allies',
      name: 'Ally Swap',
      cost: 3,
      targetType: '2 Ally Pieces',
      description: 'Hoán đổi vị trí lập tức giữa 2 quân cờ của đồng minh trên bàn cờ.',
      duration: 'Instant',
    },
    skill2: {
      id: 'magician_swap_movements',
      name: 'Movement Swap',
      cost: 4,
      targetType: '2 Enemy Pieces',
      description: 'Hoán đổi cách thức di chuyển và ăn quân giữa 2 quân cờ đối phương.',
      duration: '3 rounds',
    },
    ultimate: {
      id: 'magician_fool',
      name: 'Fool Domain',
      cost: 8,
      targetType: '5 Pieces',
      description: 'Áp dụng hiệu ứng Fool lên 5 quân cờ khiến chúng tự động tiến lên 1 ô đầu lượt.',
      duration: '5 rounds',
    }
  },
  {
    id: 'guardian',
    name: 'Guardian',
    role: 'Warden',
    difficulty: 2,
    description: 'Tạo vùng bảo hộ, khiên chặn sát thương bảo vệ Vua và các quân cờ cốt lõi.',
    artwork: '🛡️',
    resourceLabel: 'Shields active',
    passive: {
      id: 'guardian_passive',
      name: 'Holy Aura',
      cost: 'None',
      targetType: 'Passive',
      description: 'Khi mất đi 8 quân cờ, AP của Skill 1 (Holy Shield) sẽ giảm vĩnh viễn còn 2 AP.',
      duration: 'Permanent',
    },
    skill1: {
      id: 'guardian_shield',
      name: 'Holy Shield',
      cost: 4,
      targetType: 'Ally Piece',
      description: 'Tạo lớp khiên bảo vệ tuyệt đối cho 1 quân đồng minh trong vòng 2 vòng đấu.',
      duration: '2 rounds',
    },
    skill2: {
      id: 'guardian_sanctuary',
      name: 'Sanctuary',
      cost: 5,
      targetType: '3x3 Area',
      description: 'Tạo 1 vùng bảo hộ 3x3. Địch ăn quân ta trong vùng này sẽ bị làm choáng 1 vòng đấu.',
      duration: '3 rounds',
    },
    ultimate: {
      id: 'guardian_ultimate',
      name: 'Divine Shield',
      cost: 8,
      targetType: 'All Allies',
      description: 'Trao khiên bảo hộ thần thánh cho toàn bộ quân cờ đồng minh trên sân đấu trong 5 vòng đấu.',
      duration: '5 rounds',
    }
  },
  {
    id: 'requiem',
    name: 'Requiem',
    role: 'Disruptor',
    difficulty: 3,
    description: 'Thu hoạch linh hồn, nguyền rủa kẻ địch bằng Berserk và liên kết số phận các quân cờ.',
    artwork: '🎭',
    passive: {
      id: 'requiem_passive',
      name: 'Soul Harvest',
      cost: 'None',
      targetType: 'Passive',
      description: 'Mỗi khi ăn quân địch, nhận thêm +1 AP (ngoài phần thưởng thông thường).',
      duration: 'Permanent',
    },
    skill1: {
      id: 'requiem_soul_break',
      name: 'Soul Break',
      cost: 4,
      targetType: 'Enemy Piece',
      description: 'Chọn 1 quân địch (ngoại trừ Vua) để nguyền rủa bằng Berserk. Nếu không ăn quân trong thời gian quy định, quân đó bị làm choáng.',
      duration: 'Permanent',
    },
    skill2: {
      id: 'requiem_thread_of_fate',
      name: 'Thread of Fate',
      cost: 6,
      targetType: '1 Ally & 1 Enemy',
      description: 'Liên kết sinh mệnh giữa 1 quân đồng minh và 1 quân địch. Khi 1 quân chết, quân kia cũng chết theo.',
      duration: '3 rounds',
    },
    ultimate: {
      id: 'requiem_reapers_decree',
      name: "Reaper's Decree",
      cost: 10,
      targetType: '2 Enemy Pieces',
      description: 'Gắn hiệu ứng liên kết số phận Fate lên 2 quân địch. Khi 1 quân chết, quân kia cũng chết theo.',
      duration: '5 rounds',
    }
  },
  {
    id: 'ruler',
    name: 'Ruler',
    role: 'Strategist',
    difficulty: 4,
    description: 'Thay đổi luật lệ bàn cờ trong vùng ảnh hưởng để ép đối thủ phải chơi theo ý mình.',
    artwork: '👑',
    resourceLabel: 'Active law',
    passive: {
      id: 'ruler_passive',
      name: 'Royal Decree',
      cost: 'None',
      targetType: 'Passive',
      description: 'Tạo vùng chiến trường 9x9 giữa bàn cờ áp dụng Giới luật 1: Chỉ quân giống nhau mới được ăn nhau.',
      duration: 'Permanent',
    },
    skill1: {
      id: 'ruler_law2',
      name: 'Giới Luật 2',
      cost: 4,
      targetType: '9x9 Area',
      description: 'Đổi luật: Chỉ quân giá trị cao hơn mới được ăn quân giá trị thấp hơn.',
      duration: '3 rounds',
    },
    skill2: {
      id: 'ruler_law3',
      name: 'Giới Luật 3',
      cost: 4,
      targetType: '9x9 Area',
      description: 'Đổi luật: Chỉ quân giá trị thấp hơn mới được ăn quân giá trị cao hơn.',
      duration: '3 rounds',
    },
    ultimate: {
      id: 'ruler_close_field',
      name: 'Field Lock',
      cost: 10,
      targetType: '9x9 Area',
      description: 'Đóng chiến trường: Các quân ở ngoài không thể đi vào, các quân ở trong không thể đi ra.',
      duration: 'Permanent',
    }
  },
  {
    id: 'kaze',
    name: 'Kaze',
    role: 'Disruptor',
    difficulty: 3,
    description: 'Sử dụng Kunai đẩy lùi đối thủ, đặt vùng bẫy gió repelling và gọi bão hủy diệt.',
    artwork: '💨',
    resourceLabel: 'Kunai count',
    passive: {
      id: 'kaze_passive',
      name: 'Kunai Arsenal',
      cost: 'None',
      targetType: 'Passive',
      description: 'Bắt đầu trận đấu với 6 chiếc Kunai. Mỗi kỹ năng tiêu tốn 1 chiếc Kunai và hồi lại sau khi bẫy biến mất.',
      duration: 'Permanent',
    },
    skill1: {
      id: 'kaze_repel',
      name: 'Repel',
      cost: 3,
      targetType: 'Cross Empty Area',
      description: 'Chọn 1 vùng chữ thập trống và đặt hiệu ứng Repel. Đẩy lùi mọi quân đi qua.',
      duration: 'Permanent',
    },
    skill2: {
      id: 'kaze_soulless',
      name: 'Soulless',
      cost: 4,
      targetType: 'X-shape Area',
      description: 'Đặt hiệu ứng Soulless lên vùng chữ X trống. Nếu sau 2 lượt đối thủ không gỡ sẽ dính Repel.',
      duration: '2 rounds',
    },
    ultimate: {
      id: 'kaze_storm',
      name: 'Storm Winds',
      cost: 12,
      targetType: '7x7 Area',
      description: 'Thu hồi Kunai và gọi bão 7x7. Mỗi lượt bão thu hẹp (7x7 -> 5x5 -> 3x3 -> 1 ô).',
      duration: '4 rounds',
    }
  },
  {
    id: 'nephalem',
    name: 'Nephalem',
    role: 'Disruptor',
    difficulty: 4,
    description: 'Nguyền rủa đối thủ bằng Berserk, xiềng xích stun cấm di chuyển và câm lặng kỹ năng của đối thủ.',
    artwork: '😈',
    passive: {
      id: 'nephalem_passive',
      name: 'Fallen Grace',
      cost: 'None',
      targetType: 'Passive',
      description: 'Mỗi khi có 3 quân đồng minh bị tiêu diệt, nhận ngay 4 AP.',
      duration: 'Permanent',
    },
    skill1: {
      id: 'nephalem_judgment_chains',
      name: 'Judgment Chains',
      cost: 5,
      targetType: 'Enemy Piece',
      description: 'Chọn 1 quân địch (ngoại trừ Vua) để làm choáng trong 3 vòng đấu.',
      duration: '3 rounds',
    },
    skill2: {
      id: 'nephalem_berserk_curse',
      name: 'Berserk Curse',
      cost: 4,
      targetType: 'Enemy Piece',
      description: 'Chọn 1 quân địch và nguyền rủa nó bằng Berserk. Nếu trong 4 vòng đấu nó không ăn quân, nó bị làm choáng 6 lượt và xóa Berserk.',
      duration: 'Permanent',
    },
    ultimate: {
      id: 'nephalem_divine_silence',
      name: 'Divine Silence',
      cost: 8,
      targetType: 'Opponent Player',
      description: 'Câm lặng đối phương trong 3 vòng đấu, chặn sử dụng toàn bộ kỹ năng kích hoạt.',
      duration: '3 rounds',
    }
  },
  {
    id: 'angel',
    name: 'Angel',
    role: 'Warden',
    difficulty: 3,
    description: 'Bảo hộ đồng minh, thanh tẩy nguyền rủa và trừng phạt tuyệt đối đối thủ bằng Judgment.',
    artwork: '👼',
    resourceLabel: 'Judgment active',
    passive: {
      id: 'angel_passive',
      name: 'Heavenly Grace',
      cost: 'None',
      targetType: 'Passive',
      description: 'Mỗi khi 1 quân đồng minh bị tiêu diệt (bất kỳ nguyên nhân nào) nhận ngay lập tức +2 AP.',
      duration: 'Permanent',
    },
    skill1: {
      id: 'angel_holy_seal',
      name: 'Holy Seal',
      cost: 6,
      targetType: 'Enemy Piece',
      description: 'Chọn 1 quân địch (ngoại trừ Vua) để làm choáng (Stun) trong 3 vòng đấu.',
      duration: '3 rounds',
    },
    skill2: {
      id: 'angel_blessing',
      name: 'Blessing',
      cost: 4,
      targetType: 'Ally Piece',
      description: 'Chọn 1 quân đồng minh. Nếu quân đó có debuff, giải trừ toàn bộ debuff. Nếu không, ban Khiên Bảo Vệ trong 1 vòng đấu.',
      duration: 'Instant',
    },
    ultimate: {
      id: 'angel_divine_judgment',
      name: 'Divine Judgment',
      cost: 14,
      targetType: 'Global',
      description: 'Kích hoạt Vòng Trừng Phạt trong 5 vòng đấu. Bất kỳ quân địch nào ăn quân trong thời gian này sẽ nhận Dấu Ấn Trừng Phạt. Hết 5 vòng đấu, tất cả quân mang dấu ấn bị tiêu diệt tuyệt đối.',
      duration: '5 rounds',
    }
  }
];
