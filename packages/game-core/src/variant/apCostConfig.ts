export const APCostConfig = {
  lightning: {
    lightning_skill_1: 3,
    lightning_skill_2: 8,
    lightning_ultimate: 12,
  },
  zombie: {
    zombie_skill_1: 5,
    zombie_skill_2: 4,
    zombie_ultimate: 8,
  },
  dynamite: {
    dynamite_skill_1: 3,
    dynamite_skill_2: 3,
    dynamite_ultimate: 9,
  },
  magician: {
    magician_skill_1: 4,
    magician_skill_2: 7,
    magician_ultimate: 12,
  },
  guardian: {
    guardian_skill_1: 4,
    guardian_skill_1_discount: 2,
    guardian_skill_2: 5,
    guardian_ultimate: 8,
  },
  requiem: {
    requiem_skill_1: 4,
    requiem_skill_2: 6,
    requiem_ultimate: 10,
  },
  kaze: {
    kaze_skill_1: 2,
    kaze_skill_2: 3,
    kaze_ultimate: 12,
  },
  nephalem: {
    nephalem_skill_1: 5,
    nephalem_skill_2: 4,
    nephalem_ultimate: 8,
  },
  angel: {
    angel_skill_1: 6,
    angel_skill_2: 4,
    angel_ultimate: 14,
  },
  wizard: {
    wizard_skill_1: 5,
    wizard_skill_2: 4,
    wizard_ultimate: 14,
  },
  devil: {
    devil_skill_1: 5,
    devil_skill_2: 4,
    devil_ultimate: 14,
  },
  cherubim: {
    cherubim_skill_1: 2,
    cherubim_skill_2: 5,
    cherubim_ultimate: 12,
  },
  thunder_dragon: {
    thunder_dragon_skill_1: 3,
    thunder_dragon_skill_2: 6,
    thunder_dragon_ultimate: 12,
  },
  earth: {
    earth_skill_1: 3,
    earth_skill_2: 6,
    earth_ultimate: 10,
  },
  cannibal: {
    cannibal_skill_1: 3,
    cannibal_skill_2: 5,
    cannibal_ultimate: 8,
  },
  phantom: {
    phantom_skill_1: 3,
    phantom_skill_2: 4,
    phantom_ultimate: 7,
  },
  time: {
    time_skill_1: 4,
    time_skill_2: 5,
    time_ultimate: [6, 9, 15],
  },
  predator: {
    predator_skill_1: 3,
    predator_skill_2: 4,
    predator_ultimate: 9,
  },
  verdant_dragon: {
    verdant_dragon_skill_1: 3,
    verdant_dragon_skill_2: 4,
    verdant_dragon_ultimate: 9,
    verdant_dragon_ultimate_wrath: 0,
  },
  lord: {
    lord_skill_1: 4,
    lord_skill_2: 4,
    lord_ultimate: 9,
  },
  dragon_sentinel: {
    dragon_sentinel_skill_1: 4,
    dragon_sentinel_skill_2: 3,
    dragon_sentinel_ultimate: 10,
  },
  turtle: {
    turtle_skill_1: 4,
    turtle_skill_2: 4,
    turtle_ultimate: 10,
  },
  phoenix: {
    phoenix_skill_1: 3,
    phoenix_table: {
      Pawn: 3,
      Knight: 5,
      Bishop: 5,
      Rook: 7,
      Queen: 10,
    },
    phoenix_skill_2: 5,
    phoenix_ultimate: 11,
  },
  space: {
    space_skill_1: 3,
    space_skill_2: 4,
    space_ultimate: 9,
  },
  puppet: {
    puppet_skill_1: 4,
    puppet_skill_2: 3,
    puppet_ultimate: 2,
    puppet_table: {
      Pawn: 2,
      Knight: 5,
      Bishop: 5,
      Rook: 8,
      Queen: 11,
    },
  },
  ruler: {
    ruler_skill_1: 4,
    ruler_skill_2: 4,
    ruler_ultimate: 10,
  },
  pirate: {
    pirate_skill_1: 4,
    pirate_skill_2: 7,
    pirate_ultimate: 12,
  },
} as const;

export type APCostConfigType = typeof APCostConfig;
export type VariantIdWithAPConfig = keyof APCostConfigType;
